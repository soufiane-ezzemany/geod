import React, { useState } from "react";
import type { ChaosRule } from "@/types/network";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Trash2, Plus, Zap, Globe } from "lucide-react";

interface ChaosEngineeringProps {
  nodeId: string;
  onApplyRules: (rules: ChaosRule[]) => void;
}

export const ChaosEngineering: React.FC<ChaosEngineeringProps> = ({
  onApplyRules,
}) => {
  const [globalRule, setGlobalRule] = useState<ChaosRule | null>(null);
  const [globalLatency, setGlobalLatency] = useState("");
  const [globalLoss, setGlobalLoss] = useState("");
  const [globalLimit, setGlobalLimit] = useState("");

  const handleAddGlobalRule = () => {
    if (!globalLatency && !globalLoss && !globalLimit) {
      alert(
        "Please specify at least one effect (latency, loss, or bandwidth limit)",
      );
      return;
    }

    const newRule: ChaosRule = {
      target: {},
      effects: {
        ...(globalLatency && { latency: globalLatency }),
        ...(globalLoss && { loss: globalLoss }),
        ...(globalLimit && { limit: globalLimit }),
      },
    };

    setGlobalRule(newRule);
    setGlobalLatency("");
    setGlobalLoss("");
    setGlobalLimit("");
  };

  const handleRemoveRule = () => {
    setGlobalRule(null);
  };

  const handleApply = () => {
    if (globalRule) {
      onApplyRules([globalRule]);
    }
  };

  const handleClear = () => {
    onApplyRules([]);
    setGlobalRule(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Global Interface Rules</h3>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Apply chaos effects to <strong>all outgoing traffic</strong> from this
        node. Only one global rule is allowed at a time.
      </p>

      {globalRule ? (
        /* Active Rule Display */
        <div className="p-4 border rounded-xl bg-blue-50 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold text-blue-900 flex items-center gap-2 text-base">
                <Zap className="w-4 h-4" />
                Global Rule Active
              </div>
              <div className="text-blue-700 mt-1 text-sm">
                {globalRule.effects.latency && (
                  <span className="inline-block px-2 py-0.5 bg-blue-100 rounded mr-2">
                    Latency: {globalRule.effects.latency}
                  </span>
                )}
                {globalRule.effects.loss && (
                  <span className="inline-block px-2 py-0.5 bg-blue-100 rounded mr-2">
                    Loss: {globalRule.effects.loss}
                  </span>
                )}
                {globalRule.effects.limit && (
                  <span className="inline-block px-2 py-0.5 bg-blue-100 rounded">
                    Limit: {globalRule.effects.limit}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveRule}
              className="h-8 w-8 p-0 hover:bg-blue-100"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      ) : (
        /* Rule Form */
        <div className="p-4 border rounded-xl bg-slate-50/50 space-y-4">
          <div className="space-y-3">
            <div className="grid gap-1">
              <Label className="text-sm font-medium">Latency</Label>
              <Input
                placeholder="e.g., 100ms, 50ms, 200ms"
                value={globalLatency}
                onChange={(e) => setGlobalLatency(e.target.value)}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Add delay to all packets
              </p>
            </div>

            <div className="grid gap-1">
              <Label className="text-sm font-medium">Packet Loss</Label>
              <Input
                placeholder="e.g., 5%, 10%, 25%"
                value={globalLoss}
                onChange={(e) => setGlobalLoss(e.target.value)}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Randomly drop packets
              </p>
            </div>

            <div className="grid gap-1">
              <Label className="text-sm font-medium">Bandwidth Limit</Label>
              <Input
                placeholder="e.g., 10mbit, 1mbit, 100kbit"
                value={globalLimit}
                onChange={(e) => setGlobalLimit(e.target.value)}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Limit maximum bandwidth
              </p>
            </div>
          </div>

          <Button onClick={handleAddGlobalRule} className="w-full" size="lg">
            <Plus className="w-4 h-4 mr-2" />
            Set Global Rule
          </Button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleApply}
          className="flex-1"
          disabled={!globalRule}
          size="lg"
        >
          <Zap className="w-4 h-4 mr-2" />
          Apply Rule
        </Button>
        <Button
          onClick={handleClear}
          variant="outline"
          className="flex-1"
          size="lg"
        >
          Clear Rule
        </Button>
      </div>
    </div>
  );
};
