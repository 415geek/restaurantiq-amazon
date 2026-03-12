import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AgentsProxyService {
  private pythonServiceUrl: string;

  constructor(private configService: ConfigService) {
    this.pythonServiceUrl = this.configService.get<string>('PYTHON_ORCHESTRATOR_API_URL') || 'http://127.0.0.1:8010';
  }

  // TODO: Implement HTTP proxy to Python Agent microservice
  async runAgent(agentId: string, input: any) {
    try {
      const response = await axios.post(`${this.pythonServiceUrl}/agents/${agentId}/run`, input);
      return response.data;
    } catch (error) {
      console.error('❌ Python Agent service error:', error);
      throw error;
    }
  }
}