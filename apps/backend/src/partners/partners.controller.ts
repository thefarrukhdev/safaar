import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@safaar/types';
import { CurrentActor, type RequestActor } from '../common/actor';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PartnersService } from './partners.service';

@Controller(['partner', 'partners'])
@UseGuards(RolesGuard)
@Roles(Role.PARTNER)
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get('dashboard')
  dashboard(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.dashboard(actor);
  }

  @Get('profile')
  profile(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.profile(actor);
  }

  @Patch('profile')
  updateProfile(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateProfile(actor, body);
  }

  @Get('team')
  team(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.team(actor);
  }

  @Post('team')
  inviteTeamMember(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.inviteTeamMember(actor, body);
  }

  @Patch('team/:id')
  updateTeamMember(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateTeamMember(actor, id, body);
  }

  @Delete('team/:id')
  deleteTeamMember(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.deleteTeamMember(actor, id);
  }

  @Get('documents')
  documents(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.documents(actor);
  }

  @Post('documents')
  addDocument(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.addDocument(actor, body);
  }

  @Post('application/submit')
  submitApplication(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.submitApplication(actor);
  }

  @Get('application/status')
  applicationStatus(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.applicationStatus(actor);
  }

  @Post('application/resubmit')
  resubmitApplication(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.resubmitApplication(actor);
  }

  @Get('hotels')
  hotels(
    @CurrentActor() actor: RequestActor | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.partnersService.hotels(actor, query);
  }

  @Post('hotels')
  createHotel(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createHotel(actor, body);
  }

  @Get('hotels/:id')
  hotel(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.hotel(actor, id);
  }

  @Patch('hotels/:id')
  updateHotel(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateHotel(actor, id, body);
  }

  @Post('hotels/:id/reset')
  resetHotel(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.resetHotel(actor, id);
  }

  @Post('hotels/:id/submit-review')
  submitHotelReview(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.submitHotelReview(actor, id);
  }

  @Post('hotels/:id/images')
  addHotelImage(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.addHotelImage(actor, id, body);
  }

  @Delete('hotels/:id/images/:imageId')
  deleteHotelImage(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.partnersService.deleteHotelImage(actor, id, imageId);
  }

  @Patch('hotels/:id/images/:imageId')
  updateHotelImage(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateHotelImage(actor, id, imageId, body);
  }

  @Get('hotels/:id/rooms')
  rooms(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.rooms(actor, id);
  }

  @Get('hotels/:id/room-types')
  roomTypes(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.roomTypes(actor, id);
  }

  @Post('hotels/:id/room-types')
  createRoomType(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createRoomType(actor, id, body);
  }

  @Patch('hotels/:id/room-types/:roomTypeId')
  updateRoomType(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('roomTypeId') roomTypeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateRoomType(actor, id, roomTypeId, body);
  }

  @Delete('hotels/:id/room-types/:roomTypeId')
  deleteRoomType(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('roomTypeId') roomTypeId: string,
  ) {
    return this.partnersService.deleteRoomType(actor, id, roomTypeId);
  }

  @Post('hotels/:id/rooms')
  createRoom(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createRoom(actor, id, body);
  }

  @Post('hotels/:id/rooms/bulk')
  createRoomsBulk(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createRoomsBulk(actor, id, body);
  }

  @Patch('hotels/:id/rooms/:roomId')
  updateRoom(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateRoom(actor, id, roomId, body);
  }

  @Delete('hotels/:id/rooms/:roomId')
  deleteRoom(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('roomId') roomId: string,
  ) {
    return this.partnersService.deleteRoom(actor, id, roomId);
  }

  @Get('hotels/:id/beds')
  beds(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.beds(actor, id);
  }

  @Get('hotels/:id/rooms/:roomId/beds')
  roomBeds(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('roomId') roomId: string,
  ) {
    return this.partnersService.roomBeds(actor, id, roomId);
  }

  @Post('hotels/:id/rooms/:roomId/beds')
  createBed(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createBed(actor, id, roomId, body);
  }

  @Post('hotels/:id/rooms/:roomId/beds/generate')
  generateBeds(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.generateBeds(actor, id, roomId, body);
  }

  @Patch('hotels/:id/beds/:bedId')
  updateBed(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('bedId') bedId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateBed(actor, id, bedId, body);
  }

  @Delete('hotels/:id/beds/:bedId')
  deleteBed(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('bedId') bedId: string,
  ) {
    return this.partnersService.deleteBed(actor, id, bedId);
  }

  @Get('hotels/:id/inventory')
  inventory(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.inventory(actor, id);
  }

  @Put('hotels/:id/inventory')
  updateInventory(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateInventory(actor, id, body);
  }

  @Post('hotels/:id/blackout-dates')
  blackoutDates(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.blackoutDates(actor, id, body);
  }

  @Patch('hotels/:id/listing/general')
  updateListingGeneral(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateListingGeneral(actor, id, body);
  }

  @Patch('hotels/:id/listing/location')
  updateListingLocation(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateListingLocation(actor, id, body);
  }

  @Patch('hotels/:id/listing/rules')
  updateListingRules(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateListingRules(actor, id, body);
  }

  @Patch('hotels/:id/listing/amenities')
  updateListingAmenities(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateListingAmenities(actor, id, body);
  }

  @Patch('hotels/:id/listing/status')
  updateListingStatus(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateListingStatus(actor, id, body);
  }

  @Post('hotels/:id/listing/publish')
  publishListing(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.publishListing(actor, id);
  }

  @Get('bus-company')
  busCompany(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.busCompany(actor);
  }

  @Post('bus-company')
  createBusCompany(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createBusCompany(actor, body);
  }

  @Patch('bus-company')
  updateBusCompany(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateBusCompany(actor, body);
  }

  @Get('vehicles')
  vehicles(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.vehicles(actor);
  }

  @Post('vehicles')
  createVehicle(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createVehicle(actor, body);
  }

  @Patch('vehicles/:id')
  updateVehicle(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateVehicle(actor, id, body);
  }

  @Post('vehicles/:id/seat-layout')
  seatLayout(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.seatLayout(actor, id, body);
  }

  @Get('routes')
  routes(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.routes(actor);
  }

  @Post('routes')
  createRoute(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createRoute(actor, body);
  }

  @Patch('routes/:id')
  updateRoute(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateRoute(actor, id, body);
  }

  @Get('trips')
  trips(
    @CurrentActor() actor: RequestActor | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.partnersService.trips(actor, query);
  }

  @Post('trips')
  createTrip(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createTrip(actor, body);
  }

  @Patch('trips/:id')
  updateTrip(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateTrip(actor, id, body);
  }

  @Post('trips/:id/cancel')
  cancelTrip(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.cancelTrip(actor, id);
  }

  @Get('trips/:id/seats')
  tripSeats(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.tripSeats(actor, id);
  }

  @Get('bookings')
  bookings(
    @CurrentActor() actor: RequestActor | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.partnersService.bookings(actor, query);
  }

  @Post('bookings')
  createBooking(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createBooking(actor, body);
  }

  @Get('bookings/:id')
  booking(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.booking(actor, id);
  }

  @Post('bookings/:id/confirm')
  confirmBooking(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.bookingStatus(actor, id, 'confirmed');
  }

  @Post('bookings/:id/reject')
  rejectBooking(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.rejectBooking(actor, id, body);
  }

  @Post('bookings/:id/check-in')
  checkIn(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.bookingStatus(actor, id, 'checked_in');
  }

  @Post('bookings/:id/assign-room')
  assignRoom(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.assignRoom(actor, id, body);
  }

  @Post('bookings/:id/board')
  board(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.bookingStatus(actor, id, 'boarded');
  }

  @Post('bookings/:id/complete')
  complete(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.bookingStatus(actor, id, 'completed');
  }

  @Post('bookings/:id/cash-collected')
  cashCollected(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.cashStatus(actor, id, 'collected');
  }

  @Post('bookings/:id/cash-reversal')
  cashReversal(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.cashStatus(actor, id, 'reversed');
  }

  @Get('finance/overview')
  financeOverview(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.financeOverview(actor);
  }

  @Get('finance/ledger')
  ledger(
    @CurrentActor() actor: RequestActor | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.partnersService.ledger(actor, query);
  }

  @Get('finance/chart')
  financeChart(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.financeChart(actor);
  }

  @Post('withdrawals')
  withdrawal(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.withdrawal(actor, body);
  }

  @Get('withdrawals')
  withdrawals(
    @CurrentActor() actor: RequestActor | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.partnersService.withdrawals(actor, query);
  }

  @Post('exports/bookings')
  exportBookings(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createExport(actor, 'partner-bookings', body);
  }

  @Post('exports/finance')
  exportFinance(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createExport(actor, 'partner-finance', body);
  }

  @Get('finance/documents')
  financeDocuments(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.financeDocuments(actor);
  }

  @Get('finance/documents/:id/download')
  financeDocumentDownload(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.financeDocumentDownload(actor, id);
  }

  @Get('api-keys')
  apiKeys(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.apiKeys(actor);
  }

  @Post('api-keys')
  createApiKey(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createApiKey(actor, body);
  }

  @Delete('api-keys/:id')
  revokeApiKey(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.revokeApiKey(actor, id);
  }

  @Get('webhooks')
  webhooks(@CurrentActor() actor: RequestActor | undefined) {
    return this.partnersService.webhooks(actor);
  }

  @Post('webhooks')
  createWebhook(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createWebhook(actor, body);
  }

  @Patch('webhooks/:id')
  updateWebhook(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updateWebhook(actor, id, body);
  }

  @Delete('webhooks/:id')
  deleteWebhook(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.deleteWebhook(actor, id);
  }

  @Post('webhooks/:id/test')
  testWebhook(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.testWebhook(actor, id);
  }

  @Get('webhooks/:id/deliveries')
  webhookDeliveries(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.partnersService.webhookDeliveries(actor, id);
  }

  @Post('webhooks/deliveries/:deliveryId/retry')
  retryWebhookDelivery(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.partnersService.retryWebhookDelivery(actor, deliveryId);
  }

  @Post('promotions')
  createPromotion(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.createPromotion(actor, body);
  }
}
