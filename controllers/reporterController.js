const mongoose = require("mongoose");
const Article = require("../models/Article");

// Hebrew labels for the reporter UI
const STATUS_LABELS = {
  Draft: "בהכנה",
  Pending: "ממתינה לאישור עורך",
  Published: "פורסמה",
  Returned: "הוחזרה לתיקונים",
};

// The fields a reporter is allowed to change (excluding mainImage which is handled via upload/delete)
const EDITABLE_FIELDS = ['title', 'category', 'content'];

// Find an article only if it belongs to the logged in reporter (ownership check on the server)
async function findOwnArticle(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Article.findOne({ _id: req.params.id, reporter: req.user.userId });
}

// While the editor is reviewing, the reporter cannot change the article
function isLocked(article) {
  return article.status === "Pending";
}

// Was this article ever published? (the public keeps seeing publishedVersion)
function wasPublished(article) {
  return Boolean(
    article.publishedVersion && article.publishedVersion.publishedAt,
  );
}

// Copy form values into the working fields.
function applyValues(article, body = {}) {
    EDITABLE_FIELDS.forEach((field) => {
        if (body[field] !== undefined) {
            const maxLength = field === 'content' ? 50000 : 300;
            article[field] = String(body[field]).slice(0, maxLength);
        }
    });

    // Editing a published article starts a new draft of the update
    if (article.status === 'Published') article.status = 'Draft';
}

// GET /reporter/articles: the reporter's personal dashboard
exports.list = async (req, res, next) => {
  try {
    const articles = await Article.find({ reporter: req.user.userId }).sort({
      updatedAt: -1,
    });
    res.render("reporter/list", { articles, STATUS_LABELS, wasPublished });
  } catch (error) {
    next(error);
  }
};

// POST /reporter/articles/new: create an empty draft and open it in the editor
exports.create = async (req, res, next) => {
  try {
    const article = await Article.create({
      reporter: req.user.userId,
      status: "Draft",
    });
    res.redirect(`/reporter/articles/${article._id}/edit`);
  } catch (error) {
    next(error);
  }
};

// GET /reporter/articles/:id/edit: the editor page
exports.editForm = async (req, res, next) => {
  try {
    const article = await findOwnArticle(req);
    if (!article) return res.status(404).send("הכתבה לא נמצאה");
    res.render("reporter/edit", {
      article,
      STATUS_LABELS,
      locked: isLocked(article),
      published: wasPublished(article),
      error: null,
      saved: req.query.saved === "1",
    });
  } catch (error) {
    next(error);
  }
};

// POST /reporter/articles/:id/save: save the draft without sending it to the editor
exports.saveDraft = async (req, res) => {
    try {
        const article = await findOwnArticle(req);
        if (!article) return res.status(404).send('הכתבה לא נמצאה');
        if (isLocked(article)) return res.redirect('/reporter/articles');

        applyValues(article, req.body);

        // טיפול במחיקת תמונה או העלאת קובץ חדש
        if (req.body.deleteImage === 'true') {
            article.mainImage = '';
        } else if (req.file) {
            article.mainImage = '/uploads/' + req.file.filename;
        }

        await article.save();
        res.redirect(`/reporter/articles/${article._id}/edit?saved=1`);
    } catch (error) {
        logger.logError('Error saving draft', error);
        res.status(500).send('שגיאה בשמירת הטיוטה');
    }
};

// POST /reporter/articles/:id/autosave: background save from the browser, returns JSON
exports.autosave = async (req, res) => {
    try {
        const article = await findOwnArticle(req);
        if (!article) return res.status(404).json({ ok: false, message: 'Article not found' });
        if (isLocked(article)) return res.status(409).json({ ok: false, message: 'Article is under review' });

        applyValues(article, req.body);

        if (req.body.deleteImage === 'true') {
            article.mainImage = '';
        } else if (req.file) {
            article.mainImage = '/uploads/' + req.file.filename;
        }

        await article.save();
        res.json({ ok: true, savedAt: article.updatedAt });
    } catch (error) {
        logger.logError('Error auto saving article', error);
        res.status(500).json({ ok: false, message: 'Auto save failed' });
    }
    applyValues(article, req.body);
    await article.validate();
    // Newer keystrokes win even when an unload beacon arrives before an older request.
    const updated = await Article.findOneAndUpdate(
      {
        _id: article._id,
        reporter: req.user.userId,
        status: { $in: ["Draft", "Returned", "Published"] },
        $or: [
          { draftClock: { $lt: sequence } },
          { draftClock: { $exists: false } },
        ],
      },
      {
        $set: {
          ...Object.fromEntries(
            EDITABLE_FIELDS.map((field) => [field, article[field] || ""]),
          ),
          status: article.status,
          draftClock: sequence,
        },
        $inc: { __v: 1 },
      },
      { returnDocument: "after" },
    );
    if (!updated)
      return res
        .status(409)
        .json({
          message: "A newer draft was already saved. Refresh to continue.",
        });
    res.json({ ok: true, savedAt: updated.updatedAt, draftClock: sequence });
  } catch (error) {
    next(error);
  }
};

// POST /reporter/articles/:id/submit: send to the editor for approval
exports.submit = async (req, res) => {
    try {
        const article = await findOwnArticle(req);
        if (!article) return res.status(404).send('הכתבה לא נמצאה');
        if (isLocked(article)) return res.redirect('/reporter/articles');

        applyValues(article, req.body);

        // טיפול במחיקת תמונה או העלאת קובץ חדש
        if (req.body.deleteImage === 'true') {
            article.mainImage = '';
        } else if (req.file) {
            article.mainImage = '/uploads/' + req.file.filename;
        }

        // All fields must be filled before the editor sees the article
        const missing = EDITABLE_FIELDS.filter((field) => !String(article[field] || '').trim());
        const missingImage = !article.mainImage;

        if (missing.length > 0 || missingImage) {
            await article.save(); // keep what was written so far
            return res.status(400).render('reporter/edit', {
                article,
                STATUS_LABELS,
                locked: false,
                published: wasPublished(article),
                error: 'חובה למלא כותרת, קטגוריה, תמונה ראשית ותוכן לפני שליחה לעורך',
                saved: false
            });
        }

        article.status = 'Pending';
        await article.save();
        res.redirect('/reporter/articles');
    } catch (error) {
        logger.logError('Error submitting article', error);
        res.status(500).send('שגיאה בשליחה לעורך');
    }

    article.status = "Pending"; // from now on the model requires all fields
    article.draftClock = (article.draftClock || 0) + 1;
    await article.save();
    res.redirect("/reporter/articles");
  } catch (error) {
    next(error);
  }
};

// POST /reporter/articles/:id/delete: only drafts that were never published
exports.remove = async (req, res, next) => {
  try {
    const article = await findOwnArticle(req);
    if (
      article &&
      ["Draft", "Returned"].includes(article.status) &&
      !wasPublished(article)
    ) {
      await article.deleteOne();
    }
    res.redirect("/reporter/articles");
  } catch (error) {
    next(error);
  }
};
