import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
  errors?:     string[]
}

export const createError = (message: string, statusCode = 500, errors?: string[]): AppError => {
  const err: AppError = new Error(message)
  err.statusCode = statusCode
  err.errors = errors
  return err
}

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  next(createError(`Route not found — ${req.method} ${req.originalUrl}`, 404))
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500
  const message    = err.message    || 'Internal server error'

  if (process.env.NODE_ENV === 'development') {
    console.error(`❌ [${statusCode}] ${message}`, err.stack)
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
