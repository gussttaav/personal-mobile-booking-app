let _done = false;

export const rescheduleFlag = {
  mark: () => { _done = true; },
  consume: () => { const v = _done; _done = false; return v; },
};
