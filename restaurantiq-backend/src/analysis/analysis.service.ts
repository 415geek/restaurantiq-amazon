import { Injectable } from '@nestjs/common';
import { LlmRouterService } from '../llm/llm-router.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalysisService {
  constructor(
    private llmRouter: LlmRouterService,
    private prisma: PrismaService,
  ) {}

  /**
   * Run analysis using Agent D (comprehensive decision engine)
   */
  async runAnalysis(tenantId: string, input: {
    timeframe?: string;
    focus?: string;
  }) {
    // Fetch operational data
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      orderBy: { placedAt: 'desc' },
      take: 100,
    });

    // Use Claude Opus for deep analysis
    const result = await this.llmRouter.powerfulChat({
      system: `You are a restaurant operations analyst with expertise in:
- Delivery platform optimization
- Pricing strategy
- Menu engineering
- Customer satisfaction
- Operational efficiency

Analyze the provided order data and provide actionable insights.`,
      messages: [
        {
          role: 'user',
          content: `Analyze the following restaurant order data and provide:
1. Key performance metrics (orders, revenue, average order value)
2. Platform performance comparison
3. Peak hours analysis
4. Pricing optimization opportunities
5. Menu item performance
6. Actionable recommendations

Order data: ${JSON.stringify(orders, null, 2)}`,
        },
      ],
      maxTokens: 2000,
      temperature: 0.3,
    });

    // Save analysis result
    await this.prisma.agentRun.create({
      data: {
        tenantId,
        agentId: 'agent_d_synthesis',
        status: 'COMPLETED',
        input,
        output: { analysis: result.text },
        model: result.model,
        provider: result.provider,
        usage: result.usage,
      },
    });

    return {
      analysis: result.text,
      model: result.model,
      provider: result.provider,
    };
  }

  /**
   * Generate daily briefing using Claude Sonnet
   */
  async getDailyBriefing(tenantId: string) {
    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        placedAt: { gte: today },
      },
      orderBy: { placedAt: 'desc' },
    });

    // Use Claude Sonnet for balanced analysis
    const result = await this.llmRouter.balancedChat({
      system: `You are a restaurant operations manager. Generate a concise daily briefing.`,
      messages: [
        {
          role: 'user',
          content: `Generate a daily briefing for today's restaurant operations:
- Total orders and revenue
- Platform breakdown
- Top performing items
- Issues or concerns
- Tomorrow's priorities

Today's data: ${JSON.stringify(orders, null, 2)}`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.5,
    });

    return {
      briefing: result.text,
      date: today.toISOString(),
      model: result.model,
    };
  }

  /**
   * Get latest analysis result
   */
  async getLatestAnalysis(tenantId: string) {
    const latestRun = await this.prisma.agentRun.findFirst({
      where: {
        tenantId,
        agentId: 'agent_d_synthesis',
        status: 'COMPLETED',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!latestRun) {
      return { analysis: null };
    }

    return {
      analysis: latestRun.output,
      model: latestRun.model,
      completedAt: latestRun.completedAt,
    };
  }
}