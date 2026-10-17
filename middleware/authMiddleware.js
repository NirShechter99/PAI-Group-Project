const jwt = require('jsonwebtoken');

const JWT_SECRET = 'TheDailyWeb_SecretKey_2026';

// Middleware to verify if the user is logged in
exports.verifyToken = (req, res, next) => {
    // 1. Get the token from the cookies
    const token = req.cookies.token;

    // 2. If there is no token, deny access with a friendly HTML page
    if (!token) {
        return res.status(401).send(`
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>נדרשת התחברות</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f7f6; text-align: center; padding-top: 80px; direction: rtl; margin: 0; }
                    .error-container { background: white; max-width: 450px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                    h1 { color: #d9534f; margin-bottom: 15px; font-size: 24px; }
                    p { color: #555; margin-bottom: 25px; font-size: 16px; line-height: 1.5; }
                    .btn { background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: background 0.2s; }
                    .btn:hover { background-color: #0056b3; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>🔒 נדרשת התחברות למערכת</h1>
                    <p>עמוד זה מיועד למשתמשים מחוברים בלבד. יש להתחבר באמצעות חשבון עורך או כתב כדי להמשיך.</p>
                    <a href="/login" class="btn">מעבר למסך ההתחברות</a>
                </div>
            </body>
            </html>
        `);
    }

    try {
        // 3. Verify the token using our secret key
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 4. Attach the decoded user data (userId, role) to the request object
        req.user = decoded;
        
        // 5. Move to the next function (the Controller)
        next();
    } catch (error) {
        return res.status(401).send(`
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>פג תוקף ההתחברות</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f7f6; text-align: center; padding-top: 80px; direction: rtl; margin: 0; }
                    .error-container { background: white; max-width: 450px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                    h1 { color: #d9534f; margin-bottom: 15px; font-size: 24px; }
                    p { color: #555; margin-bottom: 25px; font-size: 16px; line-height: 1.5; }
                    .btn { background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; }
                    .btn:hover { background-color: #0056b3; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>⏳ פג תוקף ההתחברות</h1>
                    <p>הטוקן שלך פג תוקף או אינו תקין. אנא התחבר מחדש למערכת.</p>
                    <a href="/login" class="btn">מעבר למסך ההתחברות</a>
                </div>
            </body>
            </html>
        `);
    }
};

// Middleware to restrict access to Editors only
exports.requireEditor = (req, res, next) => {
    if (req.user && req.user.role === 'Editor') {
        next();
    } else {
        res.status(403).send(`
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>אין הרשאה</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f7f6; text-align: center; padding-top: 80px; direction: rtl; margin: 0; }
                    .error-container { background: white; max-width: 450px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                    h1 { color: #d9534f; margin-bottom: 15px; font-size: 24px; }
                    p { color: #555; margin-bottom: 25px; font-size: 16px; }
                    .btn { background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>🚫 אין הרשאה (עורכים בלבד)</h1>
                    <p>עמוד זה מיוצר עבור עורכי המערכת בלבד.</p>
                    <a href="/" class="btn">חזרה לעמוד הבית</a>
                </div>
            </body>
            </html>
        `);
    }
  }
  next();
};

// Middleware to restrict access to Reporters or Editors
exports.requireStaff = (req, res, next) => {
    if (req.user && (req.user.role === 'Reporter' || req.user.role === 'Editor')) {
        next();
    } else {
        res.status(403).send(`
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>אין הרשאה</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f7f6; text-align: center; padding-top: 80px; direction: rtl; margin: 0; }
                    .error-container { background: white; max-width: 450px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                    h1 { color: #d9534f; margin-bottom: 15px; font-size: 24px; }
                    p { color: #555; margin-bottom: 25px; font-size: 16px; }
                    .btn { background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>🚫 אין הרשאה</h1>
                    <p>עמוד זה מיועד לצוות המערכת בלבד.</p>
                    <a href="/" class="btn">חזרה לעמוד הבית</a>
                </div>
            </body>
            </html>
        `);
    }
};

// Middleware to restrict access to Reporters only
exports.requireReporter = (req, res, next) => {
    if (req.user && req.user.role === 'Reporter') {
        next();
    } else {
        res.status(403).send(`
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>אין הרשאה</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f7f6; text-align: center; padding-top: 80px; direction: rtl; margin: 0; }
                    .error-container { background: white; max-width: 450px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                    h1 { color: #d9534f; margin-bottom: 15px; font-size: 24px; }
                    p { color: #555; margin-bottom: 25px; font-size: 16px; }
                    .btn { background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>🚫 אין הרשאה (כתבים בלבד)</h1>
                    <p>עמוד זה מיועד לכתבים בלבד.</p>
                    <a href="/" class="btn">חזרה לעמוד הבית</a>
                </div>
            </body>
            </html>
        `);
    }
};
