const { User, Post, Like, Comment } = require('../models/');
const enhancePosts = require('../utils/post-enhancer');

function ultraHyperSearch(query, items, options = {}) {
  const { fuzzyThreshold = 0.7, caseSensitive = false } = options;
  const normalize = (str) => (caseSensitive ? str : str.toLowerCase());
  const normalizedQuery = normalize(query);
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  const tokenize = (str) => {
    return str.split(/(\W+)/).filter((token) => token.trim().length > 0);
  };

  const isMatch = (item) => {
    const normalizedItem = normalize(item);
    if (normalizedItem.includes(normalizedQuery)) {
      return true;
    }

    const itemTokens = tokenize(normalizedItem);
    const normalizedQueryTokens = tokenize(normalizedQuery);

    let queryIndex = 0;
    for (const itemToken of itemTokens) {
      if (
        queryIndex < normalizedQueryTokens.length &&
        isTokenSimilar(itemToken, normalizedQueryTokens[queryIndex], fuzzyThreshold)
      ) {
        queryIndex++;
      }
    }

    if (queryIndex === normalizedQueryTokens.length) {
      return true;
    }

    const allQueryTokensMatched = normalizedQueryTokens.every((queryToken) =>
      itemTokens.some((itemToken) => isTokenSimilar(itemToken, queryToken, fuzzyThreshold))
    );

    if (allQueryTokensMatched) {
      return true;
    }

    return false;
  };

  return items.filter((item) => isMatch(item));
}

function isTokenSimilar(token1, token2, threshold) {
  if (token1 === token2) return true;
  const lengthRatio =
    Math.min(token1.length, token2.length) / Math.max(token1.length, token2.length);
  if (lengthRatio < 0.7) return false;

  const bigrams1 = getBigrams(token1);
  const bigrams2 = getBigrams(token2);

  const intersection = bigrams1.filter((bigram) => bigrams2.includes(bigram));
  const similarity = (2 * intersection.length) / (bigrams1.length + bigrams2.length);

  return similarity >= threshold;
}

function getBigrams(str) {
  const bigrams = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}

exports.searchAll = async (req, res) => {
  try {
    const { q, page = 1, limit = 10, type = 'all' } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 1 character long',
      });
    }

    const searchQuery = q.trim().toLowerCase();
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let users = [];
    let posts = [];

    if (type === 'all' || type === 'users') {
      const allUsers = await User.find().select('username name bio avatar isVerified');

      const matchedUsers = allUsers.filter(
        (user) =>
          ultraHyperSearch(
            searchQuery,
            [`${user.username || ''} ${user.name || ''} ${user.bio || ''}`.toLowerCase()],
            { fuzzyThreshold: 0.6 }
          ).length > 0
      );

      users = matchedUsers.slice(skip, skip + limitNum);
    }

    if (type === 'all' || type === 'posts') {
      const allPosts = await Post.find({ visibility: 'public' })
        .populate('authorId', 'username avatar name')
        .sort({ createdAt: -1 });

      const matchedPosts = allPosts.filter(
        (post) =>
          ultraHyperSearch(
            searchQuery,
            [
              `${post.caption || ''} ${post.authorId?.username || ''} ${
                post.authorId?.name || ''
              }`.toLowerCase(),
            ],
            { fuzzyThreshold: 0.6 }
          ).length > 0
      );

      const paginatedPosts = matchedPosts.slice(skip, skip + limitNum);

      posts = await enhancePosts(paginatedPosts, req.user);
    }

    res.json({
      success: true,
      users,
      posts,
      pagination: {
        current: pageNum,
        hasMore:
          type === 'users'
            ? users.length === limitNum
            : type === 'posts'
            ? posts.length === limitNum
            : users.length + posts.length === limitNum * 2,
      },
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      success: false,
      message: 'Error performing search',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
