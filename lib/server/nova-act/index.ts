/**
 * Amazon Nova Act Module
 *
 * Browser automation for restaurant operations:
 * - Competitor menu/price scanning
 * - Automated price updates across platforms
 * - Review monitoring and response
 *
 * Usage:
 * ```typescript
 * import {
 *   getNovaActClient,
 *   createCompetitorAnalysisService,
 * } from '@/lib/server/nova-act';
 *
 * // Check configuration
 * const client = getNovaActClient();
 * const config = client.checkConfiguration();
 *
 * // Scan competitors
 * const results = await client.scanCompetitorMenu('doordash', 'chinese restaurant', 'SF');
 *
 * // Run full analysis
 * const service = createCompetitorAnalysisService();
 * const analysis = await service.runFullAnalysis(myMenu, ['doordash', 'ubereats'], 'SF');
 * ```
 */

export * from './types';
export * from './browser-client';
export * from './competitor-analysis';

/**
 * Nova Act Module
 * UI Automation for RestaurantIQ
 * 
 * Features:
 * - Competitor scanning on delivery platforms (DoorDash, UberEats, GrubHub, HungryPanda, Fantuan)
 * - Review monitoring on Google, Yelp, Xiaohongshu
 * - Automated price/menu synchronization across platforms
 * 
 * Usage:
 * ```typescript
 * import { scanCompetitors, monitorReviews, checkNovaActConfig } from '@/lib/server/nova-act';
 * 
 * // Check if Nova Act is configured
 * const config = checkNovaActConfig();
 * if (!config.configured) {
 *   console.log(config.message);
 * }
 * 
 * // Scan competitors
 * const competitors = await scanCompetitors('doordash', 'chinese restaurant', '123 Main St');
 * 
 * // Monitor reviews
 * const reviews = await monitorReviews('google', 'My Restaurant Name');
 * ```
 */

export {
  NovaActClient,
  novaActClient,
  scanCompetitors,
  monitorReviews,
  checkNovaActConfig,
  type NovaActConfig,
  type NovaActTask,
  type CompetitorScanResult,
  type ReviewMonitorResult,
} from './client';
