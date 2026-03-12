import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * Run analysis
   */
  @Post('run')
  async runAnalysis(
    @Body() body: { tenantId: string; timeframe?: string; focus?: string },
  ) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const result = await this.analysisService.runAnalysis(body.tenantId, {
        timeframe: body.timeframe,
        focus: body.focus,
      });
      return result;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to run analysis');
    }
  }

  /**
   * Get latest analysis
   */
  @Get('latest')
  async getLatestAnalysis(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    return await this.analysisService.getLatestAnalysis(tenantId);
  }

  /**
   * Get daily briefing
   */
  @Get('daily-briefing')
  async getDailyBriefing(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const result = await this.analysisService.getDailyBriefing(tenantId);
      return result;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to generate daily briefing');
    }
  }
}