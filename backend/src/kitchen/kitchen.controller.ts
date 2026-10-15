import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { KitchenService } from './kitchen.service';

@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  // ---------------------------------------------------------
  // PRODUCTS (Raw Materials from Canteen Products)
  // ---------------------------------------------------------
  @Get('products')
  getProducts() {
    return this.kitchenService.getProducts();
  }

  // ---------------------------------------------------------
  // CONSUMPTION ENTRIES
  // ---------------------------------------------------------
  @Get('consumptions')
  getConsumptions(
    @Query('dateStr') dateStr?: string,
    @Query('mealType') mealType?: string,
    @Query('productId') productId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    return this.kitchenService.getConsumptions({ dateStr, mealType, productId, fromDate, toDate });
  }

  @Post('consumptions')
  createConsumption(@Body() body: {
    dateStr: string;
    mealType: string;
    productId: string;
    quantityTaken: number;
    wastage?: number;
    remarks?: string;
    batchId?: string;
  }) {
    return this.kitchenService.createConsumption(body);
  }

  @Put('consumptions/:id')
  updateConsumption(
    @Param('id') id: string,
    @Body() body: {
      mealType?: string;
      productId?: string;
      dateStr?: string;
      quantityTaken?: number;
      wastage?: number;
      remarks?: string;
    }
  ) {
    return this.kitchenService.updateConsumption(id, body);
  }

  @Delete('consumptions/:id')
  deleteConsumption(@Param('id') id: string) {
    return this.kitchenService.deleteConsumption(id);
  }
}
