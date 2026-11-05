import cases from "./plainWords.cases.json";
import { plainAnswer, plainWords } from "./plainWords";

// The same cases the server's blinqscribe/plain.py is checked against (tests/test_brief_conversation.py).
describe("plain words", () => {
  it.each(cases.words)("%s", (written, said) => {
    expect(plainWords(written)).toBe(said);
  });
});

describe("plain answers", () => {
  it.each(cases.answers)("%s", (written, said) => {
    expect(plainAnswer(written)).toBe(said);
  });
});
