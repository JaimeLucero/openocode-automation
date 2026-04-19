import { useState } from 'react';
import { FolderOpen, Check, Plus, X, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface MCPServer {
  id: string;
  name: string;
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

interface AutomationConfig {
  projectDir: string;
  plannerModel: string;
  builderModel: string;
  testerModel: string;
  opencodeKey?: string;
  telegramToken?: string;
  chatId?: string;
  projectMdContent?: string;
  mcpServers?: MCPServer[];
}

interface OnboardingProps {
  onStart: (config: AutomationConfig) => void;
  error?: string | null;
  onClearError?: () => void;
}

type Step = 'project' | 'models' | 'mcp' | 'telegram' | 'ready';

const STEPS: Step[] = ['project', 'models', 'mcp', 'telegram', 'ready'];

const MODEL_PROVIDER_MAP: Record<string, string> = {
  'Kimi K2.5': 'opencode-go/kimi-k2.5',
  'Kimi K2 0905': 'opencode-go/kimi-k2.5',
  'Kimi K2 Thinking': 'opencode-go/kimi-k2.5',
  'GLM-5': 'opencode-go/glm-5',
  'GLM-5.1': 'opencode-go/glm-5.1',
  'GLM-4.6': 'opencode-go/glm-4.6',
  'GLM-4.7': 'opencode-go/glm-4.7',
  'Mimo-V2-Pro': 'opencode-go/mimo-v2-pro',
  'Mimo-V2-Omni': 'opencode-go/mimo-v2-omni',
  'MiniMax M2.5': 'opencode-go/minimax-m2.5',
  'MiniMax M2.7': 'opencode-go/minimax-m2.7',
  'MiniMax M2.1': 'opencode-go/minimax-m2.5',
  'MiniMax M2': 'opencode-go/minimax-m2.5',
  'MiniMax M2.5 Free': 'opencode/minimax-m2.5-free',
  'Qwen3.5 Plus': 'opencode-go/qwen3.5-plus',
  'Qwen3.6 Plus': 'opencode-go/qwen3.6-plus',
  'Big Pickle': 'opencode/big-pickle',
  'Stealth': 'opencode/big-pickle',
  'Claude Haiku 4.5': 'anthropic/claude-haiku-4.5',
  'Claude Opus 4.1': 'anthropic/claude-opus-4.1',
  'Claude Opus 4.5': 'anthropic/claude-opus-4.5',
  'Claude Opus 4.6': 'anthropic/claude-opus-4.6',
  'Claude Opus 4.7': 'anthropic/claude-opus-4.7',
  'Claude Sonnet 4': 'anthropic/claude-sonnet-4',
  'Claude Sonnet 4.5': 'anthropic/claude-sonnet-4.5',
  'Claude Sonnet 4.6': 'anthropic/claude-sonnet-4.6',
  'GPT-5': 'openai/gpt-5',
  'GPT-5 Codex': 'openai/gpt-5-codex',
  'GPT-5 Nano': 'opencode/gpt-5-nano',
  'GPT-4o': 'openai/gpt-4o',
  'GPT-4o Mini': 'openai/gpt-4o-mini',
  'GPT-4.5': 'openai/gpt-4.5',
  'Gemini 3 Flash': 'google/gemini-3-flash',
  'Gemini 3 Pro': 'google/gemini-3-pro',
  'Gemini 3.1 Pro': 'google/gemini-3.1-pro',
  'Nemotron 3 Super Free': 'opencode/nemotron-3-super-free',
  'Trinity Large Preview': 'openai/trinity-large-preview',
};

function getOpenCodeModel(uiModel: string): string {
  return MODEL_PROVIDER_MAP[uiModel] || uiModel;
}

const MODELS = [
  'Kimi K2.5',
  'Kimi K2 0905',
  'Kimi K2 Thinking',
  'GLM-5',
  'GLM-5.1',
  'GLM-4.6',
  'GLM-4.7',
  'Mimo-V2-Pro',
  'Mimo-V2-Omni',
  'MiniMax M2.5',
  'MiniMax M2.7',
  'MiniMax M2.1',
  'MiniMax M2',
  'MiniMax M2.5 Free',
  'Qwen3.5 Plus',
  'Qwen3.6 Plus',
  'Big Pickle',
  'Stealth',
  'Claude Haiku 4.5',
  'Claude Opus 4.1',
  'Claude Opus 4.5',
  'Claude Opus 4.6',
  'Claude Opus 4.7',
  'Claude Sonnet 4',
  'Claude Sonnet 4.5',
  'Claude Sonnet 4.6',
  'GPT 5',
  'GPT 5 Codex',
  'GPT 5 Nano',
  'GPT 5.1',
  'GPT 5.1 Codex',
  'GPT 5.1 Codex Max',
  'GPT 5.1 Codex Mini',
  'GPT 5.2',
  'GPT 5.2 Codex',
  'GPT 5.3 Codex',
  'GPT 5.3 Codex Spark',
  'GPT 5.4',
  'GPT 5.4 Mini',
  'GPT 5.4 Nano',
  'GPT 5.4 Pro',
  'Gemini 3 Flash',
  'Gemini 3 Pro',
  'Gemini 3.1 Pro',
  'Nemotron 3 Super Free',
  'Trinity Large Preview',
];

const PRESET_MCP_SERVERS = [
  {
    id: 'context7',
    name: 'Context7',
    description: 'Search through documentation',
    type: 'remote' as const,
    url: 'https://mcp.context7.com/mcp',
    presetHeaders: { 'CONTEXT7_API_KEY': '{env:CONTEXT7_API_KEY}' },
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Monitor errors and issues',
    type: 'remote' as const,
    url: 'https://mcp.sentry.dev/mcp',
  },
  {
    id: 'gh_grep',
    name: 'GitHub Grep',
    description: 'Search code snippets on GitHub',
    type: 'remote' as const,
    url: 'https://mcp.grep.app',
  },
  {
    id: 'everything',
    name: 'Everything (Local)',
    description: 'Local MCP server for testing',
    type: 'local' as const,
    command: ['npx', '-y', '@modelcontextprotocol/server-everything'],
  },
];

export function Onboarding({ onStart, error }: OnboardingProps) {
  const [step, setStep] = useState<Step>('project');
  const [projectDir, setProjectDir] = useState('');
  const [projectMdContent, setProjectMdContent] = useState('');
  const [projectMdError, setProjectMdError] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [plannerModel, setPlannerModel] = useState('kimi-k2.5');
  const [builderModel, setBuilderModel] = useState('kimi-k2.5');
  const [testerModel, setTesterModel] = useState('kimi-k2.5');
  const [opencodeKey, setOpencodeKey] = useState('');
  const [selectedMcpServers, setSelectedMcpServers] = useState<Set<string>>(new Set());
  const [customMcpName, setCustomMcpName] = useState('');
  const [customMcpType, setCustomMcpType] = useState<'local' | 'remote'>('local');
  const [customMcpCommand, setCustomMcpCommand] = useState('');
  const [customMcpUrl, setCustomMcpUrl] = useState('');

  const currentStepIndex = STEPS.indexOf(step);

  const handleSelectDirectory = async () => {
    const dir = await window.electron.selectDirectory();
    if (dir) {
      setProjectDir(dir);
      setProjectMdError('');

      const response = await window.electron.validateProjectMd?.(dir);

      if (response?.exists) {
        setProjectMdContent(response.content || '');
      } else {
        setProjectMdError('PROJECT.md not found in the selected directory.');
      }
    }
  };

  const toggleMcpServer = (id: string) => {
    const newSet = new Set(selectedMcpServers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMcpServers(newSet);
  };

  const addCustomMcp = () => {
    if (!customMcpName.trim()) return;
    const newSet = new Set(selectedMcpServers);
    newSet.add(`custom_${Date.now()}`);
    setSelectedMcpServers(newSet);
    setCustomMcpName('');
    setCustomMcpCommand('');
    setCustomMcpUrl('');
  };

  const getMcpServersConfig = (): MCPServer[] => {
    const servers: MCPServer[] = [];
    selectedMcpServers.forEach((id) => {
      const preset = PRESET_MCP_SERVERS.find((p) => p.id === id);
      if (preset) {
        servers.push({
          id: preset.id,
          name: preset.name,
          type: preset.type,
          command: preset.command,
          url: preset.url,
          headers: preset.presetHeaders,
        });
      }
    });
    return servers;
  };

  const canProceedFromProject = projectDir && !projectMdError && projectMdContent;

  const handleStart = () => {
    const mcpServers = getMcpServersConfig();
    onStart({
      projectDir,
      plannerModel: getOpenCodeModel(plannerModel),
      builderModel: getOpenCodeModel(builderModel),
      testerModel: getOpenCodeModel(testerModel),
      opencodeKey: opencodeKey || undefined,
      telegramToken: telegramToken || undefined,
      chatId: chatId || undefined,
      projectMdContent: projectMdContent || undefined,
      mcpServers: mcpServers.length > 0 ? mcpServers : undefined,
    });
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const getStepLabel = (s: Step) => {
    switch (s) {
      case 'project': return '1. Project';
      case 'models': return '2. Models';
      case 'mcp': return '3. MCP';
      case 'telegram': return '4. Telegram';
      case 'ready': return '5. Start';
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">OpenCode Orchestrator</h1>
          <p className="text-muted-foreground">Automate your development workflow</p>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((s, idx) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                idx <= currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 'project' && 'Select Project Directory'}
              {step === 'models' && 'Configure AI Models'}
              {step === 'mcp' && 'MCP Servers (Optional)'}
              {step === 'telegram' && 'Telegram Notifications (Optional)'}
              {step === 'ready' && 'Ready to Start'}
            </CardTitle>
            <CardDescription>
              {step === 'project' && 'Choose a directory containing PROJECT.md with your project context and TODO tickets.'}
              {step === 'models' && 'Select the model for each agent.'}
              {step === 'mcp' && 'Add Model Context Protocol servers to extend agent capabilities.'}
              {step === 'telegram' && 'Connect a Telegram bot to receive automation updates.'}
              {step === 'ready' && 'Review your configuration and start the automation.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 'project' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input value={projectDir} readOnly placeholder="Select a directory..." className="flex-1" />
                  <Button onClick={handleSelectDirectory} variant="outline">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Browse
                  </Button>
                </div>
                {projectMdError && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    {projectMdError}
                  </div>
                )}
                {projectMdContent && (
                  <div className="p-3 bg-green-500/10 text-green-500 text-sm rounded-md flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Found PROJECT.md with TODO tickets
                  </div>
                )}
              </div>
            )}

            {step === 'models' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Planner Model (Planning & Analysis)</label>
                  <Select value={plannerModel} onValueChange={setPlannerModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m} value={m.toLowerCase().replace(/\s/g, '-')}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Builder Model (Code Implementation)</label>
                  <Select value={builderModel} onValueChange={setBuilderModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m} value={m.toLowerCase().replace(/\s/g, '-')}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tester Model (Testing & QA)</label>
                  <Select value={testerModel} onValueChange={setTesterModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m} value={m.toLowerCase().replace(/\s/g, '-')}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">OpenCode API Key (Optional)</label>
                  <Input
                    type="password"
                    value={opencodeKey}
                    onChange={(e) => setOpencodeKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-muted-foreground">Required if not already configured in your system</p>
                </div>
              </div>
            )}

            {step === 'mcp' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Preset Servers</label>
                  {PRESET_MCP_SERVERS.map((server) => (
                    <div key={server.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                      <Checkbox
                        checked={selectedMcpServers.has(server.id)}
                        onCheckedChange={() => toggleMcpServer(server.id)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{server.name}</span>
                          <Badge variant="outline" className="text-xs">{server.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{server.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <label className="text-sm font-medium">Add Custom MCP Server</label>
                  <Input
                    value={customMcpName}
                    onChange={(e) => setCustomMcpName(e.target.value)}
                    placeholder="Server name (e.g., my-mcp)"
                  />
                  <Select value={customMcpType} onValueChange={(v) => setCustomMcpType(v as 'local' | 'remote')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                  {customMcpType === 'local' ? (
                    <Input
                      value={customMcpCommand}
                      onChange={(e) => setCustomMcpCommand(e.target.value)}
                      placeholder="Command (e.g., npx -y @modelcontextprotocol/server-everything)"
                    />
                  ) : (
                    <Input
                      value={customMcpUrl}
                      onChange={(e) => setCustomMcpUrl(e.target.value)}
                      placeholder="URL (e.g., https://mcp.example.com/mcp)"
                    />
                  )}
                  <Button onClick={addCustomMcp} disabled={!customMcpName.trim()} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Custom Server
                  </Button>
                </div>

                {selectedMcpServers.size > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selected: {selectedMcpServers.size} server(s)</label>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedMcpServers).map((id) => {
                        const preset = PRESET_MCP_SERVERS.find((p) => p.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="gap-1">
                            {preset?.name || 'Custom'}
                            <button onClick={() => toggleMcpServer(id)} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'telegram' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bot Token</label>
                  <Input
                    type="password"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="123456:ABC-DEF..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chat ID</label>
                  <Input
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="123456789"
                  />
                </div>
              </div>
            )}

            {step === 'ready' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Project</span>
                    <span className="font-medium">{projectDir.split('/').pop()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Planner</span>
                    <span className="font-medium">{plannerModel}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Builder</span>
                    <span className="font-medium">{builderModel}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Tester</span>
                    <span className="font-medium">{testerModel}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">MCP Servers</span>
                    <span className="font-medium">
                      {selectedMcpServers.size > 0 ? `${selectedMcpServers.size} server(s)` : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Telegram</span>
                    <span className="font-medium">{telegramToken ? 'Connected' : 'Not configured'}</span>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    {error}
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-2">
            <Button variant="outline" onClick={goBack} disabled={currentStepIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            {step === 'mcp' && (
              <Button variant="outline" onClick={goNext}>
                Skip
              </Button>
            )}
            {step !== 'ready' && step !== 'mcp' && (
              <Button onClick={goNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 'ready' && (
              <Button onClick={handleStart}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Start Automation
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
