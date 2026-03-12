import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('reviews')
  async getReviews() {
    // TODO: Implement unified reviews retrieval
    return { status: 'not_implemented' };
  }

  @Post('reviews/:id/reply')
  async replyReview(@Param('id') id: string, @Body() body: { reply: string }) {
    // TODO: Implement review reply
    return { status: 'not_implemented' };
  }

  @Post('reviews/:id/ai-reply')
  async aiReplyReview(@Param('id') id: string) {
    // TODO: Implement AI-generated review reply
    return { status: 'not_implemented' };
  }
}