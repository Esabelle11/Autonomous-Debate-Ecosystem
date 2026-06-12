export function buildTimeline(transcript) {
    let time = 0;
  
    const timeline = [];
  
    for (const line of transcript) {
      const duration =
        Math.max(4, line.text.length / 12);
  
      timeline.push({
        speaker: line.speaker,
        start: time,
        end: time + duration
      });
  
      time += duration;
    }
  
    return timeline;
  }