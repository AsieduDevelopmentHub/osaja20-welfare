"""Trie (prefix tree) for fast member prefix search."""


class MemberSearchTrie:
    def __init__(self) -> None:
        self._root: dict = {"children": {}, "member_ids": set(), "terminal": False}

    def _create_node(self) -> dict:
        return {"children": {}, "member_ids": set(), "terminal": False}

    @staticmethod
    def _normalize(text: str) -> str:
        return text.lower().strip()

    def insert(self, member_id: str, *fields: str) -> None:
        for field in fields:
            normalized = self._normalize(field)
            node = self._root
            for char in normalized:
                if char not in node["children"]:
                    node["children"][char] = self._create_node()
                node = node["children"][char]
                node["member_ids"].add(member_id)
            node["terminal"] = True

    def remove(self, member_id: str, *fields: str) -> None:
        for field in fields:
            normalized = self._normalize(field)
            node = self._root
            for char in normalized:
                child = node["children"].get(char)
                if not child:
                    break
                child["member_ids"].discard(member_id)
                node = child

    def search(self, prefix: str, limit: int = 50) -> list[str]:
        normalized = self._normalize(prefix)
        node = self._root
        for char in normalized:
            child = node["children"].get(char)
            if not child:
                return []
            node = child
        return list(node["member_ids"])[:limit]

    def clear(self) -> None:
        self._root = self._create_node()
