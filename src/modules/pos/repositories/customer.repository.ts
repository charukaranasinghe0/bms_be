import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PosCustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhone(phone: string) {
    return this.prisma.customer.findUnique({
      where: { phone },
    });
  }
}
