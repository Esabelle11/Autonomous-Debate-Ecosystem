
export async function retry(fn, retries = 5, delay = 20000) {
    let lastError;
  
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        console.log(`Attempt ${i + 1} failed`);
  
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
  
    throw lastError;
  }