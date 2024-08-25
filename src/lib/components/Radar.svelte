<script lang="ts">
  import { onMount } from "svelte";

  export let radarBackgroundColor = "rgb(240, 240, 240)"; // Default radar background color
  export let lineCount = 12; // Default number of lines (8 lines = every 45 degrees)

  function setAnimationEnabled(bool: boolean) {
    const radar = document.querySelector(".radar");
    const dots = document.querySelectorAll(".radar__dot");

    radar?.classList.remove("radar--animate");
    dots.forEach((dot) => dot.classList.remove("radar__dot--animate"));
    if (bool) {
      radar?.classList.add("radar--animate");
      dots.forEach((dot) => dot.classList.add("radar__dot--animate"));
    }
  }
</script>

<div
  class="radar radar--animate"
  role="button"
  tabindex="0"
  style="border: 1px solid #ccc; height: 40px; width: 40px; margin-top: -5px; --radar-bg-color: {radarBackgroundColor};"
  on:mouseenter={() => setAnimationEnabled(true)}
  on:mouseleave={() => setAnimationEnabled(false)}
>
  <div class="radar__dot radar__dot--animate"></div>
  <div class="radar__dot radar__dot--animate"></div>
  {#each Array(lineCount) as _, i}
    <div
    class="radar__line"
    style="transform: rotate({360 / lineCount * i}deg) translateX(-50%);"
    ></div>
  {/each}
  <div class="radar__dot radar__dot--animate"></div>
</div>

<style>
  .radar {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    box-sizing: border-box;
    background-color: var(--radar-bg-color);
    background-image: radial-gradient(
        circle at center,
        transparent 0px,
        rgb(228, 228, 228) 1px,
        transparent 3px
      ),
      radial-gradient(
        circle at center,
        transparent 5px,
        rgb(228, 228, 228) 6px,
        transparent 8px
      ),
      radial-gradient(
        circle at center,
        transparent 12px,
        rgb(228, 228, 228) 13px,
        transparent 15px
      );
    background-size: cover;
    z-index: 1; /* Layer this below the animation */
  }

  /* ::after handles the rotating conic gradient */
  .radar::after {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0;
    background-image: conic-gradient(transparent 85%, rgba(80, 255, 0, 0.45));
    border-radius: 50%;
    border: 1px solid lightgray;
    z-index: 3; /* Layer this above the static background */
  }

  .radar--animate::after {
      opacity: 1;
      animation: spin 3s linear forwards;
      animation-iteration-count: 2;
  }

  /* Line styling */
  .radar__line {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 1px;
    background-color: rgba(200, 200, 200, 0.2);
    transform-origin: 0 0;
    z-index: 2; /* Below dots but above background */
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
      opacity: 1; /* Fully visible */
    }
    99.99% {
      transform: rotate(360deg);
      opacity: 1; /* Stay visible until just before the end of the last iteration */
    }
    100% {
      opacity: 0; /* Hide after the final iteration */
    }
  }

  .radar__dot {
    position: absolute;
    width: 15%;
    height: 15%;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background-color: #eb4f27;
    z-index: 4; /* Ensure dots are on top */
  }

  .radar__dot--animate {
    opacity: 0; /* Initially hidden */
    animation: blink 3s ease-out infinite;
    animation-iteration-count: 1;
    animation-fill-mode: forwards; /* Keep the final state after animation ends */
  }

  @keyframes blink {
    0% {
      opacity: 0; /* Start hidden */
    }
    20% {
      opacity: 1; /* Appear */
    }
    99.99% {
      opacity: 0; /* Stay visible during most of the animation */
    }
    100% {
      opacity: 1; /* Stay visible at the end */
    }
  }

  .radar__dot:first-of-type {
    top: 24%;
    left: 76%;
    animation-delay: 0.375s;
  }

  .radar__dot:nth-of-type(2) {
    top: 80%;
    left: 20%;
    animation-delay: 1.875s;
  }

  .radar__dot:last-of-type {
    top: 36%;
    left: 36%;
    animation-delay: 2.625s;
  }
</style>
