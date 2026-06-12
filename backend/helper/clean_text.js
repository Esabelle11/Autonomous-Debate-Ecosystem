
export  function cleanText(text) {
    return text
      .replace(/\*.*?\*/g, "")
      .replace(/#{1,6}/g, "")
      .replace(/\|.*\|/g, "")
      .replace(/\n{2,}/g, " ")
      .replace(/\*\*/g, "")
      .replace(/Alex:\s*/i, "")
      .replace(/Sarah:\s*/i, "")
      .replace(/Marcus:\s*/i, "")
      .trim();
  }