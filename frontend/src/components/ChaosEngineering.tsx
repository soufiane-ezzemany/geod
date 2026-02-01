import React, { useState } from 'react';
import type { ChaosRule } from '@/types/network';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Trash2, Plus, Zap, Globe, Target } from 'lucide-react';
import { Separator } from './ui/separator';

interface ChaosEngineeringProps {
  nodeId: string;
  onApplyRules: (rules: ChaosRule[]) => void;
}

export const ChaosEngineering: React.FC<ChaosEngineeringProps> = ({
  onApplyRules,
}) => {
  const [rules, setRules] = useState<ChaosRule[]>([]);
  const [globalLatency, setGlobalLatency] = useState('');
  const [globalLoss, setGlobalLoss] = useState('');
  const [globalLimit, setGlobalLimit] = useState('');
  const [currentRule, setCurrentRule] = useState<ChaosRule>({
    target: {},
    effects: {},
  });

  const handleAddGlobalRule = () => {
    if (!globalLatency && !globalLoss && !globalLimit) {
      alert('Please specify at least one global effect');
      return;
    }

    const globalRule: ChaosRule = {
      target: {},
      effects: {
        ...(globalLatency && { latency: globalLatency }),
        ...(globalLoss && { loss: globalLoss }),
        ...(globalLimit && { limit: globalLimit }),
      },
    };

    const nonGlobalRules = rules.filter((r) => r.target && Object.keys(r.target).length > 0);
    setRules([globalRule, ...nonGlobalRules]);

    setGlobalLatency('');
    setGlobalLoss('');
    setGlobalLimit('');
  };

  const handleAddGranularRule = () => {
    if (!currentRule.target || Object.keys(currentRule.target).length === 0) {
      alert('Please specify at least one target parameter (IP, port, or subnet)');
      return;
    }
    if (Object.keys(currentRule.effects).length === 0) {
      alert('Please specify at least one effect');
      return;
    }

    setRules([...rules, { ...currentRule }]);
    setCurrentRule({ target: {}, effects: {} });
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onApplyRules(rules);
  };

  const handleClear = () => {
    onApplyRules([]);
    setRules([]);
  };

  const globalRule = rules.find((r) => !r.target || Object.keys(r.target).length === 0);
  const granularRules = rules.filter((r) => r.target && Object.keys(r.target).length > 0);

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          Global Interface Rules
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          Apply effects to all traffic on this interface. Only one global rule allowed.
        </p>

        {globalRule ? (
          <div className="p-3 border rounded bg-blue-50 text-xs mb-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-blue-900">Global Rule Active</div>
                <div className="text-blue-700 mt-1">
                  {globalRule.effects.latency && `Latency: ${globalRule.effects.latency} `}
                  {globalRule.effects.loss && `Loss: ${globalRule.effects.loss} `}
                  {globalRule.effects.limit && `Limit: ${globalRule.effects.limit}`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRule(rules.indexOf(globalRule))}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label className="text-xs">Latency</Label>
              <Input
                placeholder="e.g., 100ms"
                size={1}
                value={globalLatency}
                onChange={(e) => setGlobalLatency(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs">Packet Loss</Label>
              <Input
                placeholder="e.g., 5%"
                size={1}
                value={globalLoss}
                onChange={(e) => setGlobalLoss(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs">Bandwidth Limit</Label>
              <Input
                placeholder="e.g., 10mbit"
                size={1}
                value={globalLimit}
                onChange={(e) => setGlobalLimit(e.target.value)}
              />
            </div>

            <Button onClick={handleAddGlobalRule} className="w-full" size="sm">
              <Plus className="w-3 h-3 mr-1" />
              Add Global Rule
            </Button>
          </div>
        )}
      </div>

      <Separator />

      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-500" />
          Granular Target Rules
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          Apply effects to specific IP addresses, ports, or subnets. Multiple rules allowed.
        </p>

        <div className="space-y-3">
          <div className="grid gap-2">
            <Label className="text-xs font-semibold">Target</Label>
            <Input
              placeholder="Destination IP (e.g., 192.168.1.100)"
              size={1}
              value={currentRule.target?.dst_ip || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  target: { ...currentRule.target, dst_ip: e.target.value },
                })
              }
            />
            <Input
              placeholder="Destination Subnet (e.g., 10.0.0.0/24)"
              size={1}
              value={currentRule.target?.dst_subnet || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  target: { ...currentRule.target, dst_subnet: e.target.value },
                })
              }
            />
            <Input
              placeholder="Port (e.g., 6379)"
              type="number"
              size={1}
              value={currentRule.target?.dst_port || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  target: {
                    ...currentRule.target,
                    dst_port: parseInt(e.target.value) || undefined,
                  },
                })
              }
            />
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
              value={currentRule.target?.protocol || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  target: {
                    ...currentRule.target,
                    protocol: e.target.value as 'tcp' | 'udp' | undefined,
                  },
                })
              }
            >
              <option value="">Protocol (optional)</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-semibold">Effects</Label>
            <Input
              placeholder="Latency (e.g., 100ms)"
              size={1}
              value={currentRule.effects.latency || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  effects: { ...currentRule.effects, latency: e.target.value },
                })
              }
            />
            <Input
              placeholder="Packet Loss (e.g., 5%)"
              size={1}
              value={currentRule.effects.loss || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  effects: { ...currentRule.effects, loss: e.target.value },
                })
              }
            />
            <Input
              placeholder="Bandwidth Limit (e.g., 10mbit)"
              size={1}
              value={currentRule.effects.limit || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  effects: { ...currentRule.effects, limit: e.target.value },
                })
              }
            />
          </div>

          <Button onClick={handleAddGranularRule} className="w-full" size="sm">
            <Plus className="w-3 h-3 mr-1" />
            Add Granular Rule
          </Button>
        </div>
      </div>

      {granularRules.length > 0 && (
        <div className="p-4 border rounded-lg bg-card">
          <h4 className="text-sm font-semibold mb-3">
            Active Granular Rules ({granularRules.length})
          </h4>

          <div className="space-y-2">
            {granularRules.map((rule, index) => {
              const actualIndex = rules.indexOf(rule);
              return (
                <div
                  key={index}
                  className="p-2 border rounded bg-slate-50 text-xs flex justify-between items-start"
                >
                  <div>
                    <div className="font-medium">
                      {rule.target?.dst_ip || rule.target?.dst_subnet || 'Unknown target'}
                      {rule.target?.dst_port && `:${rule.target.dst_port}`}
                      {rule.target?.protocol && ` (${rule.target.protocol.toUpperCase()})`}
                    </div>
                    <div className="text-muted-foreground">
                      {rule.effects.latency && `Latency: ${rule.effects.latency} `}
                      {rule.effects.loss && `Loss: ${rule.effects.loss} `}
                      {rule.effects.limit && `Limit: ${rule.effects.limit}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRule(actualIndex)}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1">
          <Zap className="w-4 h-4 mr-2" />
          Apply All Rules
        </Button>
        <Button onClick={handleClear} variant="outline" className="flex-1">
          Clear All
        </Button>
      </div>
    </div>
  );
};
