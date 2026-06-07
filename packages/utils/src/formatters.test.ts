import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCurrency, formatDate, paginate } from "./index.js";

describe("formatCurrency", () => {
  it("formats GHS amounts", () => {
    const result = formatCurrency(30);
    assert.match(result, /30/);
    assert.match(result, /GH|₵|GHS/i);
  });
});

describe("formatDate", () => {
  it("formats ISO date strings", () => {
    const result = formatDate("2020-06-15");
    assert.match(result, /2020/);
    assert.match(result, /June|Jun/i);
  });
});

describe("paginate", () => {
  it("returns correct page slice", () => {
    const items = [1, 2, 3, 4, 5];
    const page = paginate(items, 2, 2);
    assert.deepEqual(page.items, [3, 4]);
    assert.equal(page.total, 5);
    assert.equal(page.totalPages, 3);
  });
});
