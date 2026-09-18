import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

type CatalogQuery = Record<string, string | string[] | undefined>;

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('regions')
  regions() {
    return this.catalogService.regions();
  }

  @Get('cities')
  cities() {
    return this.catalogService.cities();
  }

  @Get('amenities')
  amenities() {
    return this.catalogService.amenities();
  }

  @Get('room-types')
  roomTypes() {
    return this.catalogService.roomTypes();
  }

  @Get('cancellation-policies')
  cancellationPolicies() {
    return this.catalogService.cancellationPolicies();
  }

  @Get('popular-cities')
  popularCities() {
    return this.catalogService.popularCities();
  }

  @Get('destinations')
  destinations() {
    return this.catalogService.destinations();
  }

  @Get('partners-showcase')
  partnersShowcase() {
    return this.catalogService.partnersShowcase();
  }

  @Get('attractions')
  attractions(@Query() query: CatalogQuery) {
    return this.catalogService.attractions(query);
  }

  @Get('restaurants')
  restaurants(@Query() query: CatalogQuery) {
    return this.catalogService.restaurants(query);
  }

  @Get('transports')
  transports(
    @Query('check_in') checkIn?: string,
    @Query('check_out') checkOut?: string,
  ) {
    return this.catalogService.transports(checkIn, checkOut);
  }

  @Get('transports/:id')
  transport(@Param('id') id: string) {
    return this.catalogService.transport(id);
  }
}

@Controller('attractions')
export class AttractionsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  findAll(@Query() query: CatalogQuery) {
    return this.catalogService.attractions(query);
  }
}

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  findAll(@Query() query: CatalogQuery) {
    return this.catalogService.restaurants(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catalogService.restaurant(id);
  }
}
