// "K7MQ2XPA" → "K7MQ-2XPA" (okuması ve telefonda söylemesi kolay)
export const prettyCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
