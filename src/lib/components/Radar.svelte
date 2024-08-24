<script>
  export let circleSpacing = 2; // Spacing between circles
  export let numCircles = 3;     // Number of circles
  export let radarBackgroundColor = 'lightgrey'; // Default radar background color

  let radarStyle;

  $: radarStyle = `
    background-image: 
      radial-gradient(circle at center, 
                      transparent ${circleSpacing}px, 
                      rgba(80, 255, 0, 0.35) ${circleSpacing + 2}px, 
                      transparent ${circleSpacing + 4}px),
      radial-gradient(circle at center, 
                      transparent ${circleSpacing * 2}px, 
                      rgba(80, 255, 0, 0.35) ${circleSpacing * 2 + 2}px, 
                      transparent ${circleSpacing * 2 + 4}px),
      radial-gradient(circle at center, 
                      transparent ${circleSpacing * 3}px, 
                      rgba(80, 255, 0, 0.35) ${circleSpacing * 3 + 2}px, 
                      transparent ${circleSpacing * 3 + 4}px);
  `;
</script>

<style>
  .radar {
    border: 1px solid #aaa;
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    box-sizing: border-box;
  }

  /* ::before adds the static background color */
  .radar::before {
    content: "";
    position: absolute;
    inset: 0;
    background-color: var(--radar-bg-color);
    border-radius: 50%;
    z-index: 1; /* Layer this below the animation */
  }

  /* ::after handles the rotating conic gradient */
  .radar::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: conic-gradient(transparent 90%, rgba(80, 255, 0, 0.35));
    border-radius: 50%;
    box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.9);
    animation: spin 2s linear infinite;
    z-index: 3; /* Layer this above the static background */
  }

  .radar__content {
    position: absolute;
    inset: 0;
    z-index: 2; /* Layer this between the background and the rotating gradient */
  }

  .radar__dot {
    position: absolute;
    width: 10%;
    height: 10%;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: blink 2s ease-out infinite;
    z-index: 4; /* Ensure dots are on top */
  }

  .radar__dot:first-of-type {
    top: 24%;
    left: 76%;
    animation-delay: 0.25s;
  }

  .radar__dot:nth-of-type(2) {
    top: 80%;
    left: 20%;
    animation-delay: 1.25s;
  }

  .radar__dot:last-of-type {
    top: 36%;
    left: 36%;
    animation-delay: 1.75s;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }

  @keyframes blink {
    2%,
    20% {
      background-color: rgba(80, 255, 0, 0.85);
      box-shadow: 0 0 2px rgba(80, 255, 0, 0.6);
    }

    90% {
      background-color: transparent;
    }
  }
</style>

<div class="radar" style="--radar-bg-color: {radarBackgroundColor};">
  <div class="radar__content" style={radarStyle}></div>
  <div class="radar__dot"></div>
  <div class="radar__dot"></div>
  <div class="radar__dot"></div>
</div>
