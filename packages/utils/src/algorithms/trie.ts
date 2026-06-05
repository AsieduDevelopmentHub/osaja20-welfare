/**
 * Trie (prefix tree) for O(1) average-case member prefix search.
 * Indexes member names, emails, and membership IDs for fast autocomplete.
 */

interface TrieNode {
  children: Map<string, TrieNode>;
  memberIds: Set<string>;
  isTerminal: boolean;
}

export class MemberSearchTrie {
  private root: TrieNode = this.createNode();

  private createNode(): TrieNode {
    return { children: new Map(), memberIds: new Set(), isTerminal: false };
  }

  private normalize(text: string): string {
    return text.toLowerCase().trim();
  }

  insert(memberId: string, ...fields: string[]): void {
    for (const field of fields) {
      const normalized = this.normalize(field);
      let node = this.root;

      for (const char of normalized) {
        if (!node.children.has(char)) {
          node.children.set(char, this.createNode());
        }
        node = node.children.get(char)!;
        node.memberIds.add(memberId);
      }
      node.isTerminal = true;
    }
  }

  remove(memberId: string, ...fields: string[]): void {
    for (const field of fields) {
      const normalized = this.normalize(field);
      let node = this.root;

      for (const char of normalized) {
        const child = node.children.get(char);
        if (!child) break;
        child.memberIds.delete(memberId);
        node = child;
      }
    }
  }

  search(prefix: string, limit = 50): string[] {
    const normalized = this.normalize(prefix);
    let node = this.root;

    for (const char of normalized) {
      const child = node.children.get(char);
      if (!child) return [];
      node = child;
    }

    return [...node.memberIds].slice(0, limit);
  }

  clear(): void {
    this.root = this.createNode();
  }

  size(): number {
    return this.root.memberIds.size;
  }
}
