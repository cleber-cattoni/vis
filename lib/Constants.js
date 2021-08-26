`export const CROSS = Object.freeze({
  size: 6,
  margin: 1,
});

export const ARROW = Object.freeze({
  padding: {
    right: 1,
    left: 1,
  },
  calculateSize: function (baseSize) {
    const width = baseSize + this.padding.left + this.padding.right;

    return {
      width,
      height: width / 2,
    };
  }
});
