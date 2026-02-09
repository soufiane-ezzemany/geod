import React, { useState } from "react";
import type { ChaosRule } from "@/types/network";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Trash2, Plus, Zap, Target, ChevronDown } from "lucide-react";
import type { OtherNode } from "./topology/NodeConfigPanel";

interface TargetRulesProps {
  nodeId: string;
  availableNodes: OtherNode[];
  onApplyRules: (rules: ChaosRule[]) => void;
}

export const TargetRules: React.FC<TargetRulesProps> = ({
  availableNodes,
  onApplyRules,
}) => {
  const [rules, setRules] = useState<ChaosRule[]>([]);
  const [currentRule, setCurrentRule] = useState<ChaosRule>({
    target: {},
    effects: {},
  });

  const handleAddGranularRule = () => {
    if (!currentRule.target || Object.keys(currentRule.target).length === 0) {
      alert("Please select a target node or specify an IP address");
      return;
    }
    if (Object.keys(currentRule.effects).length === 0) {
      alert("Please specify at least one effect (latency, loss, or limit)");
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

  const handleSelectNode = (node: OtherNode) => {
    if (node.ip) {
      setCurrentRule({
        ...currentRule,
        target: { ...currentRule.target, dst_ip: node.ip },
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-semibold">Granular Target Rules</h3>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Apply chaos effects to specific destination nodes. Select from connected
        nodes or enter custom IPs.
      </p>

      {/* Target Selection */}
      <div className="p-4 border rounded-xl bg-slate-50/50 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <ChevronDown className="w-4 h-4" />
            Select Destination Node
          </Label>

          {/* Node buttons grid */}
          <div className="grid grid-cols-2 gap-2">
            {availableNodes.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground py-3 text-center">
                No other nodes available
              </p>
            ) : (
              availableNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => handleSelectNode(node)}
                  className={`
                    p-3 text-left rounded-lg border transition-all duration-200
                    ${
                      currentRule.target?.dst_ip === node.ip
                        ? "bg-primary/10 border-primary text-primary shadow-sm"
                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                    }
                  `}
                >
                  <div className="font-medium text-sm truncate">
                    {node.hostname}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {node.ip || "No IP"}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Custom IP option */}
          <div className="pt-2">
            <Label className="text-xs text-muted-foreground">
              Or enter custom IP/Subnet:
            </Label>
            <Input
              placeholder="e.g., 192.168.1.100 or 10.0.0.0/24"
              className="mt-1"
              value={
                currentRule.target?.dst_ip ||
                currentRule.target?.dst_subnet ||
                ""
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes("/")) {
                  setCurrentRule({
                    ...currentRule,
                    target: { dst_subnet: value },
                  });
                } else {
                  setCurrentRule({
                    ...currentRule,
                    target: { dst_ip: value },
                  });
                }
              }}
            />
          </div>

          {/* Port & Protocol */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Port (optional)
              </Label>
              <Input
                placeholder="e.g., 6379"
                type="number"
                className="mt-1"
                value={currentRule.target?.dst_port || ""}
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
            <div>
              <Label className="text-xs text-muted-foreground">Protocol</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors mt-1"
                value={currentRule.target?.protocol || ""}
                onChange={(e) =>
                  setCurrentRule({
                    ...currentRule,
                    target: {
                      ...currentRule.target,
                      protocol: e.target.value as "tcp" | "udp" | undefined,
                    },
                  })
                }
              >
                <option value="">Any</option>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Effects */}
      <div className="p-4 border rounded-xl bg-slate-50/50 space-y-3">
        <Label className="text-sm font-semibold">Chaos Effects</Label>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Latency</Label>
            <Input
              placeholder="100ms"
              className="mt-1"
              value={currentRule.effects.latency || ""}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  effects: { ...currentRule.effects, latency: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Packet Loss</Label>
            <Input
              placeholder="5%"
              className="mt-1"
              value={currentRule.effects.loss || ""}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  effects: { ...currentRule.effects, loss: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Bandwidth</Label>
            <Input
              placeholder="10mbit"
              className="mt-1"
              value={currentRule.effects.limit || ""}
              onChange={(e) =>
                setCurrentRule({
                  ...currentRule,
                  effects: { ...currentRule.effects, limit: e.target.value },
                })
              }
            />
          </div>
        </div>

        <Button onClick={handleAddGranularRule} className="w-full" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Target Rule
        </Button>
      </div>

      {/* Active Rules */}
      {rules.length > 0 && (
        <div className="p-4 border rounded-xl bg-card">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Active Rules ({rules.length})
          </h4>

          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="p-3 border rounded-lg bg-amber-50 text-sm flex justify-between items-start"
              >
                <div>
                  <div className="font-medium text-amber-900">
                    →{" "}
                    {rule.target?.dst_ip ||
                      rule.target?.dst_subnet ||
                      "Unknown"}
                    {rule.target?.dst_port && `:${rule.target.dst_port}`}
                    {rule.target?.protocol &&
                      ` (${rule.target.protocol.toUpperCase()})`}
                  </div>
                  <div className="text-amber-700 text-xs mt-0.5">
                    {rule.effects.latency &&
                      `Latency: ${rule.effects.latency} `}
                    {rule.effects.loss && `Loss: ${rule.effects.loss} `}
                    {rule.effects.limit && `Limit: ${rule.effects.limit}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRule(index)}
                  className="h-7 w-7 p-0 hover:bg-amber-100"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleApply}
          className="flex-1"
          disabled={rules.length === 0}
        >
          <Zap className="w-4 h-4 mr-2" />
          Apply {rules.length > 0 && `(${rules.length})`} Rules
        </Button>
        <Button onClick={handleClear} variant="outline" className="flex-1">
          Clear All
        </Button>
      </div>
    </div>
  );
};
