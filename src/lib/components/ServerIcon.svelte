<script lang="ts">
  // Props for customization
  export let width: string = "100%";
  export let height: string = "auto";
  export let className: string = "";
  
  // Generate random blink durations for LEDs (much faster)
  const getRandomDuration = () => (Math.random() * 0.5 + 0.2).toFixed(1);
  const getRandomDelay = () => (Math.random() * 0.3).toFixed(1);
  
  // Random duration for the red activity LED
  const redLedDuration = getRandomDuration();
  const redLedDelay = getRandomDelay();
  
  // Random durations for the drive LEDs
  const driveLedDurations = Array(6).fill(0).map(() => getRandomDuration());
  const driveLedDelays = Array(6).fill(0).map(() => getRandomDelay());
</script>

<div class={`server-icon ${className}`}>
  <svg preserveAspectRatio="xMidYMid meet" viewBox="30 40 540 120" xmlns="http://www.w3.org/2000/svg" width={width} height={height}>
    <!-- Main Server Body -->
    <rect x="50" y="40" width="500" height="120" rx="5" ry="5" fill="#4b5056" />
    
    <!-- Left Mounting Bracket -->
    <rect x="30" y="50" width="20" height="100" rx="2" ry="2" fill="#3d4045" />
    <!-- Left Bracket Holes -->
    <circle cx="40" cy="70" r="5" fill="#2a2d31" />
    <circle cx="40" cy="130" r="5" fill="#2a2d31" />
    
    <!-- Right Mounting Bracket -->
    <rect x="550" y="50" width="20" height="100" rx="2" ry="2" fill="#3d4045" />
    <!-- Right Bracket Holes -->
    <circle cx="560" cy="70" r="5" fill="#2a2d31" />
    <circle cx="560" cy="130" r="5" fill="#2a2d31" />
    
    <!-- Ventilation Grid -->
    <rect x="70" y="60" width="80" height="80" fill="#3d4045" />
    <!-- Ventilation Holes (5x5 grid) -->
    <g fill="#2a2d31">
      <!-- Create a 5x5 grid of ventilation holes -->
      <rect x="75" y="65" width="10" height="10" />
      <rect x="90" y="65" width="10" height="10" />
      <rect x="105" y="65" width="10" height="10" />
      <rect x="120" y="65" width="10" height="10" />
      <rect x="135" y="65" width="10" height="10" />
      
      <rect x="75" y="80" width="10" height="10" />
      <rect x="90" y="80" width="10" height="10" />
      <rect x="105" y="80" width="10" height="10" />
      <rect x="120" y="80" width="10" height="10" />
      <rect x="135" y="80" width="10" height="10" />
      
      <rect x="75" y="95" width="10" height="10" />
      <rect x="90" y="95" width="10" height="10" />
      <rect x="105" y="95" width="10" height="10" />
      <rect x="120" y="95" width="10" height="10" />
      <rect x="135" y="95" width="10" height="10" />
      
      <rect x="75" y="110" width="10" height="10" />
      <rect x="90" y="110" width="10" height="10" />
      <rect x="105" y="110" width="10" height="10" />
      <rect x="120" y="110" width="10" height="10" />
      <rect x="135" y="110" width="10" height="10" />
      
      <rect x="75" y="125" width="10" height="10" />
      <rect x="90" y="125" width="10" height="10" />
      <rect x="105" y="125" width="10" height="10" />
      <rect x="120" y="125" width="10" height="10" />
      <rect x="135" y="125" width="10" height="10" />
    </g>
    
    <!-- Indicator Lights - Power LED (green) doesn't blink, activity LED (red) blinks -->
    <circle cx="190" cy="100" r="6" fill="#22c55e" stroke="#15803d" stroke-width="1.5" />
    <circle cx="220" cy="100" r="6" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5" class="blink-led" style="animation-duration: {redLedDuration}s; animation-delay: {redLedDelay}s" />
    
    <!-- USB/Port -->
    <rect x="260" y="90" width="40" height="20" rx="3" ry="3" fill="#2a2d31" />
    <rect x="265" y="95" width="30" height="10" rx="1" ry="1" fill="#3d4045" />
    
    <!-- Horizontal Lines -->
    <line x1="180" y1="130" x2="220" y2="130" stroke="#2a2d31" stroke-width="3" />
    <line x1="230" y1="130" x2="270" y2="130" stroke="#2a2d31" stroke-width="3" />
    
    <!-- Drive Bays Section -->
    <rect x="320" y="60" width="200" height="80" rx="2" ry="2" fill="#3d4045" stroke="#2a2d31" stroke-width="2" />
    
    <!-- Drive Bay Grid - 2x3 equal sized -->
    <!-- Column divider -->
    <line x1="420" y1="60" x2="420" y2="140" stroke="#2a2d31" stroke-width="2" />
    
    <!-- Row dividers -->
    <line x1="320" y1="87" x2="520" y2="87" stroke="#2a2d31" stroke-width="2" />
    <line x1="320" y1="114" x2="520" y2="114" stroke="#2a2d31" stroke-width="2" />
    
    <!-- Drive Bay Trays - 2x3 equal sized -->
    <!-- Top row -->
    <rect x="330" y="65" width="80" height="15" rx="1" ry="1" fill="#2a2d31" />
    <rect x="430" y="65" width="80" height="15" rx="1" ry="1" fill="#2a2d31" />
    
    <!-- Middle row -->
    <rect x="330" y="92" width="80" height="15" rx="1" ry="1" fill="#2a2d31" />
    <rect x="430" y="92" width="80" height="15" rx="1" ry="1" fill="#2a2d31" />
    
    <!-- Bottom row -->
    <rect x="330" y="119" width="80" height="15" rx="1" ry="1" fill="#2a2d31" />
    <rect x="430" y="119" width="80" height="15" rx="1" ry="1" fill="#2a2d31" />
    
    <!-- Small LEDs for drive bays - All green with random blinking -->
    <!-- Top row LEDs -->
    <circle cx="325" cy="73" r="3" fill="#22c55e" class="blink-led" style="animation-duration: {driveLedDurations[0]}s; animation-delay: {driveLedDelays[0]}s" />
    <circle cx="425" cy="73" r="3" fill="#22c55e" class="blink-led" style="animation-duration: {driveLedDurations[1]}s; animation-delay: {driveLedDelays[1]}s" />
    
    <!-- Middle row LEDs -->
    <circle cx="325" cy="100" r="3" fill="#22c55e" class="blink-led" style="animation-duration: {driveLedDurations[2]}s; animation-delay: {driveLedDelays[2]}s" />
    <circle cx="425" cy="100" r="3" fill="#22c55e" class="blink-led" style="animation-duration: {driveLedDurations[3]}s; animation-delay: {driveLedDelays[3]}s" />
    
    <!-- Bottom row LEDs -->
    <circle cx="325" cy="127" r="3" fill="#22c55e" class="blink-led" style="animation-duration: {driveLedDurations[4]}s; animation-delay: {driveLedDelays[4]}s" />
    <circle cx="425" cy="127" r="3" fill="#22c55e" class="blink-led" style="animation-duration: {driveLedDurations[5]}s; animation-delay: {driveLedDelays[5]}s" />
  </svg>
</div>

<style>
  .server-icon {
    display: inline-block;
    line-height: 0;
    overflow: visible;
  }
  
  svg {
    display: block;
    vertical-align: middle;
    max-width: 100%;
  }
  
  /* LED blinking animation - abrupt on/off like real server LEDs */
  @keyframes blink {
    0%, 49%, 100% { opacity: 1; }
    50%, 99% { opacity: 0; }
  }
  
  .blink-led {
    animation: blink 0.5s infinite;
    animation-timing-function: steps(1, end);
  }
</style>