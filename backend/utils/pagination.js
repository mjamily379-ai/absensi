const getPagination = (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    return { page, limit, skip: (page - 1) * limit };
};

const buildPaginatedResponse = (data, total, page, limit) => ({
    data,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit))
});

// Legacy callers (existing frontend) expect plain arrays.
// Pagination metadata is only returned when page/limit is explicitly requested.
const isPaginatedRequest = (req) =>
    req.query.page !== undefined || req.query.limit !== undefined;

module.exports = { getPagination, buildPaginatedResponse, isPaginatedRequest };