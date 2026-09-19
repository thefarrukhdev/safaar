import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@safaar/types';
import { CurrentActor, type RequestActor } from '../common/actor';
import { Permissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/overview')
  overview() {
    return this.adminService.getOverview();
  }

  @Get('dashboard/revenue-chart')
  revenueChart() {
    return this.adminService.chart('revenue');
  }

  @Get('dashboard/bookings-chart')
  bookingsChart() {
    return this.adminService.chart('bookings');
  }

  @Get('dashboard/activity')
  activity() {
    return this.adminService.activity();
  }

  @Get('users')
  users(@Query() query: Record<string, string | undefined>) {
    return this.adminService.users(query);
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.adminService.user(id);
  }

  @Patch('users/:id/status')
  @Permissions(Permission.UsersWrite)
  userStatus(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.userStatus(id, body);
  }

  @Delete('users/:id')
  @Permissions(Permission.UsersWrite)
  userDelete(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.userDelete(actor, id);
  }

  @Post('users/:id/bonus-adjustment')
  @Permissions(Permission.FinanceWrite)
  bonusAdjustment(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.bonusAdjustment(id, body, actor);
  }

  @Get('users/:id/bookings')
  userBookings(
    @Param('id') id: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.adminService.userBookings(id, query);
  }

  @Get('users/:id/audit')
  userAudit(
    @Param('id') id: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.adminService.userAudit(id, query);
  }

  @Post('users/:id/message')
  @Permissions(Permission.UsersWrite)
  userMessage(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.userMessage(actor, id, body);
  }

  @Post('users/message')
  @Permissions(Permission.UsersWrite)
  usersMessage(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.usersMessage(actor, body);
  }

  @Post('users/export')
  @Permissions(Permission.UsersRead)
  usersExport(@CurrentActor() actor: RequestActor | undefined) {
    return this.adminService.exportJob(actor, 'admin-users', 'xlsx');
  }

  @Get('partners')
  partners(@Query() query: Record<string, string | undefined>) {
    return this.adminService.partners(query);
  }

  @Get('partners/requests')
  partnerRequests(@Query() query: Record<string, string | undefined>) {
    return this.adminService.partnerRequests(query);
  }

  @Get('partners/:id')
  partner(@Param('id') id: string) {
    return this.adminService.partner(id);
  }

  @Post('partners/:id/approve')
  @Permissions(Permission.PartnersWrite)
  partnerApprove(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.partnerDecision(actor, id, 'approved');
  }

  @Post('partners/:id/reject')
  @Permissions(Permission.PartnersWrite)
  partnerReject(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.partnerDecision(actor, id, 'rejected', body);
  }

  @Post('partners/:id/request-information')
  @Permissions(Permission.PartnersWrite)
  partnerRequestInfo(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.partnerDecision(
      actor,
      id,
      'more_information_required',
      body,
    );
  }

  @Patch('partners/:id/status')
  @Permissions(Permission.PartnersWrite)
  partnerStatus(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.partnerStatus(actor, id, body);
  }

  @Delete('partners/:id')
  @Permissions(Permission.PartnersWrite)
  partnerDelete(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.partnerDelete(actor, id);
  }

  @Get('partners/:id/commission')
  @Permissions(Permission.FinanceRead)
  partnerCommissionDetail(@Param('id') id: string) {
    return this.adminService.partnerCommissionDetail(id);
  }

  @Patch('partners/:id/commission')
  @Permissions(Permission.FinanceWrite)
  partnerCommission(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.partnerCommission(actor, id, body);
  }

  @Get('partners/:id/ledger')
  @Permissions(Permission.FinanceRead)
  partnerLedger(@Param('id') id: string) {
    return this.adminService.partnerLedger(id);
  }

  @Get('rooms/:id/availability')
  @Permissions(Permission.AvailabilityRead)
  roomAvailabilityCalendar(
    @Param('id') id: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.adminService.roomAvailabilityCalendar(id, query);
  }

  @Post('rooms/:id/block')
  @Permissions(Permission.AvailabilityBlock)
  roomAvailabilityBlock(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.roomAvailabilityBlock(actor, id, body);
  }

  @Delete('rooms/:id/block')
  @Permissions(Permission.AvailabilityBlock)
  roomAvailabilityUnblock(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.roomAvailabilityUnblock(actor, id, body);
  }

  @Get('reviews')
  @Permissions(Permission.ReviewsRead)
  reviewsList(@Query() query: Record<string, string | undefined>) {
    return this.adminService.reviewsList(query);
  }

  @Post('reviews/:id/publish')
  @Permissions(Permission.ReviewsModerate)
  reviewPublish(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.reviewModerate(actor, id, 'publish');
  }

  @Post('reviews/:id/hide')
  @Permissions(Permission.ReviewsModerate)
  reviewHide(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.reviewModerate(actor, id, 'hide');
  }

  @Post('partners/:id/adjustment')
  @Permissions(Permission.FinanceWrite)
  partnerAdjustment(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.partnerAdjustment(actor, id, body);
  }

  @Post('partners/export')
  @Permissions(Permission.PartnersRead)
  partnersExport(@CurrentActor() actor: RequestActor | undefined) {
    return this.adminService.exportJob(actor, 'admin-partners', 'xlsx');
  }

  @Get('partners/:id/notes')
  @Permissions(Permission.PartnersRead)
  partnerNotes(@Param('id') id: string) {
    return this.adminService.partnerNotes(id);
  }

  @Post('partners/:id/notes')
  @Permissions(Permission.PartnersWrite)
  addPartnerNote(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.addPartnerNote(actor, id, body);
  }

  @Get('hotels')
  hotels(@Query() query: Record<string, string | undefined>) {
    return this.adminService.hotels(query);
  }

  @Get('hotels/:id')
  hotel(@Param('id') id: string) {
    return this.adminService.hotel(id);
  }

  @Post('hotels/:id/publish')
  @Permissions(Permission.PartnersWrite)
  hotelPublish(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.hotelStatus(actor, id, 'published');
  }

  @Post('hotels/:id/reject')
  @Permissions(Permission.PartnersWrite)
  hotelReject(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.hotelStatus(
      actor,
      id,
      'rejected',
      String(body.reason ?? ''),
    );
  }

  @Patch('hotels/:id/visibility')
  @Permissions(Permission.PartnersWrite)
  hotelVisibility(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.hotelStatus(
      actor,
      id,
      body.visible === false ? 'hidden' : 'published',
    );
  }

  @Patch('hotels/:id/featured')
  @Permissions(Permission.PartnersWrite)
  hotelFeatured(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.setHotelFeatured(id, body.featured === true);
  }

  @Post('hotels/featured/reorder')
  @Permissions(Permission.PartnersWrite)
  hotelsFeaturedReorder(@Body() body: Record<string, unknown>) {
    const orderedIds = Array.isArray(body.orderedIds)
      ? (body.orderedIds as unknown[]).map((id) => String(id))
      : [];
    return this.adminService.reorderFeaturedHotels(orderedIds);
  }

  @Get('trips')
  trips(@Query() query: Record<string, string | undefined>) {
    return this.adminService.trips(query);
  }

  @Get('trips/:id')
  trip(@Param('id') id: string) {
    return this.adminService.trip(id);
  }

  @Post('trips/:id/cancel')
  tripCancel(@Param('id') id: string) {
    return this.adminService.tripStatus(id, 'cancelled');
  }

  @Get('bus-companies')
  busCompanies() {
    return this.adminService.busCompanies();
  }

  @Patch('bus-companies/:id/status')
  busCompanyStatus(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.busCompanyStatus(id, body);
  }

  @Get('bookings')
  bookings(@Query() query: Record<string, string | undefined>) {
    return this.adminService.bookings(query);
  }

  @Get('bookings/:id')
  booking(@Param('id') id: string) {
    return this.adminService.booking(id);
  }

  @Post('bookings/:id/cancel')
  @Permissions(Permission.BookingsWrite)
  bookingCancel(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.bookingCancel(actor, id, body);
  }

  @Post('bookings/:id/status-action')
  bookingStatusAction(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.bookingStatusAction(id, body);
  }

  @Get('bookings/:id/notes')
  @Permissions(Permission.BookingsRead)
  bookingNotes(@Param('id') id: string) {
    return this.adminService.bookingNotes(id);
  }

  @Post('bookings/:id/notes')
  @Permissions(Permission.BookingsWrite)
  addBookingNote(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.addBookingNote(actor, id, body);
  }

  @Get('payments')
  payments(@Query() query: Record<string, string | undefined>) {
    return this.adminService.payments(query);
  }

  @Get('payments/:id')
  payment(@Param('id') id: string) {
    return this.adminService.payment(id);
  }

  @Post('payments/:id/reconcile')
  @Permissions(Permission.FinanceWrite)
  paymentReconcile(@Param('id') id: string) {
    return this.adminService.paymentReconcile(id);
  }

  @Get('refunds')
  refunds(@Query() query: Record<string, string | undefined>) {
    return this.adminService.refunds(query);
  }

  @Get('refunds/:id')
  refund(@Param('id') id: string) {
    return this.adminService.refund(id);
  }

  @Post('refunds/:id/approve')
  @Permissions(Permission.FinanceWrite)
  refundApprove(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.refundApprove(actor, id, body);
  }

  @Post('refunds/:id/reject')
  @Permissions(Permission.FinanceWrite)
  refundReject(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.refundReject(actor, id);
  }

  @Post('refunds/:id/retry')
  @Permissions(Permission.FinanceWrite)
  refundRetry(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.refundRetry(actor, id);
  }

  @Get('finance/overview')
  @Permissions(Permission.FinanceRead)
  financeOverview() {
    return this.adminService.financeOverview();
  }

  @Get('finance/revenue-chart')
  @Permissions(Permission.FinanceRead)
  financeRevenueChart() {
    return this.adminService.chart('finance-revenue');
  }

  @Get('finance/partners-report')
  @Permissions(Permission.FinanceRead)
  partnersReport() {
    return this.adminService.partnersReport();
  }

  @Get('finance/provider-reconciliation')
  @Permissions(Permission.FinanceRead)
  providerReconciliation() {
    return this.adminService.providerReconciliation();
  }

  @Post('finance/export')
  @Permissions(Permission.FinanceRead)
  financeExport(@CurrentActor() actor: RequestActor | undefined) {
    return this.adminService.exportJob(actor, 'admin-finance', 'xlsx');
  }

  @Post('finance/tax-report-export')
  @Permissions(Permission.FinanceRead)
  taxReportExport(@CurrentActor() actor: RequestActor | undefined) {
    return this.adminService.exportJob(actor, 'tax-report', 'pdf');
  }

  @Get('finance/documents')
  @Permissions(Permission.FinanceRead)
  financeDocuments() {
    return this.adminService.financeDocuments();
  }

  @Post('finance/documents/:id/regenerate')
  @Permissions(Permission.FinanceWrite)
  financeDocumentRegenerate(@Param('id') id: string) {
    return this.adminService.financeDocumentRegenerate(id);
  }

  @Get('withdrawals')
  @Permissions(Permission.FinanceRead)
  withdrawals(@Query() query: Record<string, string | undefined>) {
    return this.adminService.withdrawals(query);
  }

  @Get('withdrawals/:id')
  @Permissions(Permission.FinanceRead)
  withdrawal(@Param('id') id: string) {
    return this.adminService.withdrawal(id);
  }

  @Post('withdrawals/:id/approve')
  @Permissions(Permission.FinanceWrite)
  withdrawalApprove(@Param('id') id: string) {
    return this.adminService.withdrawalStatus(id, 'approved');
  }

  @Post('withdrawals/:id/reject')
  @Permissions(Permission.FinanceWrite)
  withdrawalReject(@Param('id') id: string) {
    return this.adminService.withdrawalStatus(id, 'rejected');
  }

  @Post('withdrawals/:id/mark-paid')
  @Permissions(Permission.FinanceWrite)
  withdrawalMarkPaid(@Param('id') id: string) {
    return this.adminService.withdrawalStatus(id, 'paid');
  }

  @Get('cms/:resource')
  cmsList(
    @Param('resource') resource: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.adminService.cmsList(resource, query);
  }

  @Get('cms/:resource/:id')
  cmsOne(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsOne(resource, id);
  }

  @Post('cms/:resource')
  @Permissions(Permission.CmsWrite)
  cmsCreate(
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.cmsCreate(resource, body);
  }

  @Patch('cms/:resource/:id')
  @Permissions(Permission.CmsWrite)
  cmsUpdate(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.cmsUpdate(resource, id, body);
  }

  @Delete('cms/:resource/:id')
  @Permissions(Permission.CmsWrite)
  cmsDelete(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsDelete(resource, id);
  }

  @Post('cms/:resource/:id/publish')
  @Permissions(Permission.CmsWrite)
  cmsPublish(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsAction(resource, id, 'publish');
  }

  @Post('cms/:resource/:id/unpublish')
  @Permissions(Permission.CmsWrite)
  cmsUnpublish(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsAction(resource, id, 'unpublish');
  }

  @Post('cms/:resource/:id/archive')
  @Permissions(Permission.CmsWrite)
  cmsArchive(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsAction(resource, id, 'archive');
  }

  @Post('cms/:resource/:id/reorder')
  @Permissions(Permission.CmsWrite)
  cmsReorder(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsAction(resource, id, 'reorder');
  }

  @Post('cms/:resource/:id/preview')
  cmsPreview(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsAction(resource, id, 'preview');
  }

  @Post('cms/:resource/:id/test')
  cmsTest(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsAction(resource, id, 'test');
  }

  @Post('cms/:resource/:id/schedule-publish')
  @Permissions(Permission.CmsWrite)
  cmsSchedule(@Param('resource') resource: string, @Param('id') id: string) {
    return this.adminService.cmsAction(resource, id, 'schedule_publish');
  }

  @Post('cms/:resource/:id/translations')
  @Permissions(Permission.CmsWrite)
  cmsTranslation(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.cmsTranslation(resource, id, body);
  }

  @Get('promos')
  promos(@Query() query: Record<string, string | undefined>) {
    return this.adminService.promos(query);
  }

  @Post('promos')
  @Permissions(Permission.CmsWrite)
  promoCreate(@Body() body: Record<string, unknown>) {
    return this.adminService.promoCreate(body);
  }

  @Patch('promos/:id')
  @Permissions(Permission.CmsWrite)
  promoUpdate(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.promoUpdate(id, body);
  }

  @Delete('promos/:id')
  @Permissions(Permission.CmsWrite)
  promoDelete(@Param('id') id: string) {
    return this.adminService.promoDelete(id);
  }

  @Get('promos/:id/stats')
  promoStats(@Param('id') id: string) {
    return this.adminService.promoStats(id);
  }

  @Post('catalog/regions')
  @Permissions(Permission.CmsWrite)
  regionCreate(@Body() body: Record<string, unknown>) {
    return this.adminService.regionCreate(body);
  }

  @Patch('catalog/regions/:id')
  @Permissions(Permission.CmsWrite)
  regionUpdate(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.regionUpdate(id, body);
  }

  @Delete('catalog/regions/:id')
  @Permissions(Permission.CmsWrite)
  regionDelete(@Param('id') id: string) {
    return this.adminService.regionDelete(id);
  }

  @Post('catalog/amenities')
  @Permissions(Permission.CmsWrite)
  amenityCreate(@Body() body: Record<string, unknown>) {
    return this.adminService.amenityCreate(body);
  }

  @Patch('catalog/amenities/:id')
  @Permissions(Permission.CmsWrite)
  amenityUpdate(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.amenityUpdate(id, body);
  }

  @Delete('catalog/amenities/:id')
  @Permissions(Permission.CmsWrite)
  amenityDelete(@Param('id') id: string) {
    return this.adminService.amenityDelete(id);
  }

  @Get('support/tickets')
  supportTickets(@Query() query: Record<string, string | undefined>) {
    return this.adminService.supportTickets(query);
  }

  @Get('support/tickets/:id')
  supportTicket(@Param('id') id: string) {
    return this.adminService.supportTicket(id);
  }

  @Patch('support/tickets/:id/status')
  @Permissions(Permission.SupportWrite)
  supportStatus(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.supportStatus(id, body);
  }

  @Post('support/tickets/:id/messages')
  @Permissions(Permission.SupportWrite)
  supportMessage(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.supportMessage(actor, id, body);
  }

  @Post('support/tickets/:id/:action')
  @Permissions(Permission.SupportWrite)
  supportAction(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.supportAction(actor, id, action, body);
  }

  @Get('support/stats')
  supportStats() {
    return this.adminService.supportStats();
  }

  @Post('notifications/broadcast')
  @Permissions(Permission.SupportWrite)
  notificationBroadcastCreate(@Body() body: Record<string, unknown>) {
    return this.adminService.notificationBroadcastCreate(body);
  }

  @Get('notifications/broadcasts')
  notificationBroadcasts(@Query() query: Record<string, string | undefined>) {
    return this.adminService.notificationBroadcasts(query);
  }

  @Get('notifications/broadcasts/:id')
  notificationBroadcastOne(@Param('id') id: string) {
    return this.adminService.notificationBroadcastOne(id);
  }

  @Post('notifications/broadcasts/:id/:action')
  @Permissions(Permission.SupportWrite)
  notificationBroadcastAction(
    @Param('id') id: string,
    @Param('action') action: string,
  ) {
    return this.adminService.notificationBroadcastAction(id, action);
  }

  @Get('admin-users')
  @Permissions(Permission.AdminsRead)
  adminUsers(@Query() query: Record<string, string | undefined>) {
    return this.adminService.adminUsers(query);
  }

  @Post('admin-users')
  @Permissions(Permission.AdminUsersWrite)
  adminUserCreate(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.adminUserCreate(actor, body);
  }

  @Patch('admin-users/:id')
  @Permissions(Permission.AdminUsersWrite)
  adminUserUpdate(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.adminUserUpdate(actor, id, body);
  }

  @Patch('admin-users/:id/status')
  @Permissions(Permission.AdminUsersWrite)
  adminUserStatus(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.adminUserStatus(actor, id, body);
  }

  @Post('admin-users/:id/reset-2fa')
  @Permissions(Permission.AdminUsersWrite)
  adminUserReset2fa(@Param('id') id: string) {
    return this.adminService.adminUserReset2fa(id);
  }

  @Get('roles')
  @Permissions(Permission.RolesManage)
  roles() {
    return this.adminService.roles();
  }

  @Patch('roles/:id/permissions')
  @Permissions(Permission.RolesManage)
  rolePermissions() {
    return this.adminService.rolePermissions();
  }

  @Get('audit-logs')
  @Permissions(Permission.AuditLogsRead)
  auditLogs(@Query() query: Record<string, string | undefined>) {
    return this.adminService.auditLogs(query);
  }

  @Get('developer/api-keys')
  @Permissions(Permission.PartnersRead)
  developerApiKeys(@Query() query: Record<string, string | undefined>) {
    return this.adminService.developerApiKeys(query);
  }

  @Delete('developer/api-keys/:id')
  @Permissions(Permission.PartnersWrite)
  deleteDeveloperApiKey(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteDeveloperApiKey(actor, id);
  }

  @Get('developer/webhooks')
  @Permissions(Permission.PartnersRead)
  developerWebhooks(@Query() query: Record<string, string | undefined>) {
    return this.adminService.developerWebhooks(query);
  }

  @Get('settings')
  settings() {
    return this.adminService.settings();
  }

  @Patch('settings/:group')
  @Permissions(Permission.SettingsWrite)
  settingsGroup(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('group') group: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.settingsGroup(actor, group, body);
  }

  @Patch('settings/providers/:provider')
  @Permissions(Permission.SettingsWrite)
  providerSettings(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.providerSettings(provider, body);
  }

  @Post('settings/providers/:provider/test')
  providerTest(@Param('provider') provider: string) {
    return this.adminService.providerTest(provider);
  }
}
