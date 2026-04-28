/**
 * Utility helpers for common repository patterns to avoid code duplication
 */

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Calculate pagination parameters (skip, take, totalPages)
 */
export function calculatePagination(
  page: number = 1,
  limit: number = 10,
  total: number
): {
  skip: number;
  totalPages: number;
} {
  return {
    skip: (page - 1) * limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Format paginated response
 */
export function formatPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginationResult<T> {
  const { totalPages } = calculatePagination(page, limit, total);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
