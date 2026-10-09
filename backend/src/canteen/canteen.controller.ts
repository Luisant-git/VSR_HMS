import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CanteenService } from './canteen.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('canteen')
export class CanteenController {
  constructor(private readonly canteenService: CanteenService) {}

  // ---------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------
  @Get('categories')
  getCategories() {
    return this.canteenService.getCategories();
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; description?: string }) {
    return this.canteenService.createCategory(body);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: { name?: string; description?: string }) {
    return this.canteenService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.canteenService.deleteCategory(id);
  }

  // ---------------------------------------------------------
  // UNITS
  // ---------------------------------------------------------
  @Get('units')
  getUnits() {
    return this.canteenService.getUnits();
  }

  @Post('units')
  createUnit(@Body() body: { name: string; symbol?: string }) {
    return this.canteenService.createUnit(body);
  }

  @Put('units/:id')
  updateUnit(@Param('id') id: string, @Body() body: { name?: string; symbol?: string }) {
    return this.canteenService.updateUnit(id, body);
  }

  @Delete('units/:id')
  deleteUnit(@Param('id') id: string) {
    return this.canteenService.deleteUnit(id);
  }

  // ---------------------------------------------------------
  // SUPPLIERS
  // ---------------------------------------------------------
  @Get('suppliers')
  getSuppliers() {
    return this.canteenService.getSuppliers();
  }

  @Post('suppliers')
  createSupplier(@Body() body: { name: string; phone?: string; email?: string; address?: string; gstNo?: string }) {
    return this.canteenService.createSupplier(body);
  }

  @Put('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() body: { name?: string; phone?: string; email?: string; address?: string; gstNo?: string }) {
    return this.canteenService.updateSupplier(id, body);
  }

  @Delete('suppliers/:id')
  deleteSupplier(@Param('id') id: string) {
    return this.canteenService.deleteSupplier(id);
  }

  // ---------------------------------------------------------
  // PAYMENT MODES
  // ---------------------------------------------------------
  @Get('payment-modes')
  getPaymentModes() {
    return this.canteenService.getPaymentModes();
  }

  @Post('payment-modes')
  createPaymentMode(@Body() body: { name: string }) {
    return this.canteenService.createPaymentMode(body);
  }

  @Put('payment-modes/:id')
  updatePaymentMode(@Param('id') id: string, @Body() body: { name?: string }) {
    return this.canteenService.updatePaymentMode(id, body);
  }

  @Delete('payment-modes/:id')
  deletePaymentMode(@Param('id') id: string) {
    return this.canteenService.deletePaymentMode(id);
  }

  // ---------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------
  @Get('products')
  getProducts() {
    return this.canteenService.getProducts();
  }

  @Post('products')
  createProduct(@Body() body: {
    name: string;
    code?: string;
    categoryId?: string;
    brandId?: string;
    unitId?: string;
    price?: number;
    costPrice?: number;
    stock?: number;
    status?: string;
  }) {
    return this.canteenService.createProduct(body);
  }

  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: {
    name?: string;
    code?: string;
    categoryId?: string;
    brandId?: string;
    unitId?: string;
    price?: number;
    costPrice?: number;
    stock?: number;
    status?: string;
  }) {
    return this.canteenService.updateProduct(id, body);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.canteenService.deleteProduct(id);
  }

  // ---------------------------------------------------------
  // PURCHASES (Purchase Entry & Reports)
  // ---------------------------------------------------------
  @Get('purchases')
  getPurchases() {
    return this.canteenService.getPurchases();
  }

  @Get('purchases/:id')
  getPurchaseById(@Param('id') id: string) {
    return this.canteenService.getPurchaseById(id);
  }

  @Post('purchases')
  createPurchase(@Body() body: {
    supplierId?: string;
    paymentModeId?: string;
    notes?: string;
    purchaseDate?: string;
    items: Array<{
      productId?: string;
      productName: string;
      qty: number;
      unit?: string;
      price: number;
    }>;
  }) {
    return this.canteenService.createPurchase(body);
  }

  @Delete('purchases/:id')
  deletePurchase(@Param('id') id: string) {
    return this.canteenService.deletePurchase(id);
  }
}
