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
  total: number,
  page: number = 1,
  limit: number = 10
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
  const { totalPages } = calculatePagination(total, page, limit);

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

/**
 * Build search where clause for multiple fields (case-insensitive OR)
 */
export function buildSearchWhere(
  fields: string[],
  search?: string
): Record<string, unknown> | undefined {
  if (!search) return undefined;

  return {
    OR: fields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    })),
  };
}

/**
 * Generic findOneOrThrow helper for repository delegates
 */
export async function findOneOrThrow<T>(
  delegate: {
    findUnique: (options: { where: Record<string, unknown> }) => Promise<T | null>;
  },
  where: Record<string, unknown>,
  entityName: string
): Promise<T> {
  const entity = await delegate.findUnique({ where });
  if (!entity) {
    throw new Error(`${entityName} not found`);
  }
  return entity;
}
