// The public site always shows the last version an editor approved (publishedVersion),
// never the working fields a reporter may be editing right now.

// Every article that was ever approved, including one whose update is in progress
const PUBLIC_FILTER = { 'publishedVersion.publishedAt': { $exists: true } };

// Build the object the public pages and the public API receive
function toPublicArticle(article) {
    const published = article.publishedVersion || {};
    return {
        _id: article._id,
        title: published.title,
        category: published.category,
        mainImage: published.mainImage,
        content: published.content,
        publishedAt: published.publishedAt,
        author: article.reporter && article.reporter.username ? article.reporter.username : ''
    };
}

module.exports = { PUBLIC_FILTER, toPublicArticle };