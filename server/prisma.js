/**
 * server/prisma.js
 * Single Prisma client instance shared across all routes.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
