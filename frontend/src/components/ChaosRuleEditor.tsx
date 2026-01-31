import React, { useState } from 'react';
import type { ChaosRule } from '@/types/network';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Trash2, Plus, Zap } from 'lucide-react';

interface ChaosRuleEditorProps {
  nodeId: string;
  onApplyRules: (rules: ChaosRule[]) => void;
}

export const ChaosRuleEditor: React.FC<ChaosRuleEditorProps> = ({
  nodeId,
  onApplyRules,
}) => {
  const [rules, setRules] = useState<ChaosRule[]>([]);
  const [currentRule, setCurrentRule] = useState<ChaosRule>({
    target: {},
    effects: {},
  });

  const handleAddRule = () => {
    if (Object.keys(currentRule.target).length === 0) {
      alert('Please specify at least one target parameter');
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

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          Add New Rule
        </h4>

        <div className="space-y-3">
          <div className="grid gap-2">
            <Label className="text-xs">Target</Label>
            <Input
              placeholder="Destination IP (e.g., 192.168.1.100)"
              size={1}
              value={currentRule.target.dst_ip || ''}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  target: { ...currentRule.target, dst_ip: e.target.value },
                })
              }
            />
            <Input
              placeholder="Port (e.g., 6379)"
              type="number"
              size={1}
              value={currentRule.target.dst_port || ''}
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
          </div>

          <div className="grid gap-2">
            <Label className="text-xs">Effects</Label>
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

          <Button onClick={handleAddRule} className="w-full" size="sm">
            <Plus className="w-3 h-3 mr-1" />
            Add Rule
          </Button>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-semibold mb-3">
          Active Rules ({rules.length})
        </h4>

        {rules.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No rules defined yet
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="p-2 border rounded bg-slate-50 text-xs flex justify-between items-start"
              >
                <div>
                  <div className="font-medium">
                    {rule.target.dst_ip}
                    {rule.target.dst_port && `:${rule.target.dst_port}`}
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
                  onClick={() => handleRemoveRule(index)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1">
          Apply All Rules
        </Button>
        <Button onClick={handleClear} variant="outline" className="flex-1">
          Clear All
        </Button>
      </div>
    </div>
  );
};
