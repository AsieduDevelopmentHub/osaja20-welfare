/**
 * Finite state machine for welfare case workflow transitions.
 * Mirrors apps/api/v1/core/algorithms/state_machine.py
 */

import type { WelfareStatus } from "@osaja/types";

type TransitionMap = Record<WelfareStatus, WelfareStatus[]>;

const WELFARE_TRANSITIONS: TransitionMap = {
  pending: ["approved"],
  approved: ["allocated", "archived"],
  allocated: ["resolved", "archived"],
  resolved: ["archived"],
  archived: [],
};

export class WelfareStateMachine {
  private transitions: TransitionMap;

  constructor(transitions: TransitionMap = WELFARE_TRANSITIONS) {
    this.transitions = transitions;
  }

  canTransition(from: WelfareStatus, to: WelfareStatus): boolean {
    return this.transitions[from]?.includes(to) ?? false;
  }

  transition(
    current: WelfareStatus,
    target: WelfareStatus
  ): { success: boolean; newStatus?: WelfareStatus; error?: string } {
    if (current === target) {
      return { success: true, newStatus: current };
    }

    if (!this.canTransition(current, target)) {
      return {
        success: false,
        error: `Invalid transition from '${current}' to '${target}'`,
      };
    }

    return { success: true, newStatus: target };
  }

  getAvailableTransitions(status: WelfareStatus): WelfareStatus[] {
    return [...(this.transitions[status] ?? [])];
  }

  isTerminal(status: WelfareStatus): boolean {
    return (this.transitions[status]?.length ?? 0) === 0;
  }
}
