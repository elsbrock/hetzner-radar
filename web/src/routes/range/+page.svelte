<script lang="ts">
    let minprice = 0;
    let maxprice = 10000;
    const min = 0;
    const max = 10000;

    $: minthumb = ((minprice - min) / (max - min)) * 100;
    $: maxthumb = ((maxprice - min) / (max - min)) * 100;

    function mintrigger(event) {
        const value = Number(event.target.value);
        if (value < maxprice - 500) {
            minprice = Math.max(min, value);
        } else {
            minprice = maxprice - 500;
        }
    }

    function maxtrigger(event) {
        const value = Number(event.target.value);
        if (value > minprice + 500) {
            maxprice = Math.min(max, value);
        } else {
            maxprice = minprice + 500;
        }
    }

    function startDrag(handleType, event) {
        event.preventDefault();
        const moveHandler = handleType === 'min' ? handleMinDrag : handleMaxDrag;
        const stopHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', stopHandler);
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', stopHandler);
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', stopHandler);
        document.addEventListener('touchmove', moveHandler);
        document.addEventListener('touchend', stopHandler);
    }

    function handleMinDrag(event) {
        const rect = event.target.parentElement.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const offsetX = clientX - rect.left;
        const newValue = Math.round((offsetX / rect.width) * (max - min) + min);
        if (newValue < maxprice - 500) {
            minprice = Math.max(min, newValue);
        } else {
            minprice = maxprice - 500;
        }
    }

    function handleMaxDrag(event) {
        const rect = event.target.parentElement.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const offsetX = clientX - rect.left;
        const newValue = Math.round((offsetX / rect.width) * (max - min) + min);
        if (newValue > minprice + 500) {
            maxprice = Math.min(max, newValue);
        } else {
            maxprice = minprice + 500;
        }
    }
</script>

<div class="h-screen flex justify-center items-center">
    <div class="relative max-w-xl w-full">
        <div>
            <input type="range"
                   step="100"
                   min={min}
                   max={max}
                   bind:value={minprice}
                   on:input={mintrigger}
                   class="absolute z-25 h-2 w-full opacity-0 cursor-pointer">

            <input type="range" 
                   step="100"
                   min={min}
                   max={max}
                   bind:value={maxprice}
                   on:input={maxtrigger}
                   class="absolute z-20 h-2 w-full opacity-0 cursor-pointer">

            <div class="relative z-10 h-2">
                <div class="absolute z-10 left-0 right-0 bottom-0 top-0 rounded-md bg-gray-200"></div>
                <div class="absolute z-20 top-0 bottom-0 rounded-md bg-blue-300" style={`left:${minthumb}%; right:${100 - maxthumb}%`}></div>
                <div class="absolute z-30 w-6 h-6 top-0 bg-blue-300 rounded-full -mt-2 -ml-3 cursor-pointer"
                     style={`left: ${minthumb}%`}
                     on:mousedown={(e) => startDrag('min', e)}
                     on:touchstart={(e) => startDrag('min', e)}></div>
                <div class="absolute z-30 w-6 h-6 top-0 bg-blue-300 rounded-full -mt-2 -mr-3 cursor-pointer"
                     style={`left: ${maxthumb}%`}
                     on:mousedown={(e) => startDrag('max', e)}
                     on:touchstart={(e) => startDrag('max', e)}></div>
            </div>
        </div>
    </div>
</div>