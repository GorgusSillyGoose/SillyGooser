(function () {
  function createSilentWav(durationSeconds, sampleRate) {
    const channels = 1;
    const bitsPerSample = 16;
    const seconds = durationSeconds || 1;
    const rate = sampleRate || 8000;
    const sampleCount = Math.max(1, Math.floor(seconds * rate));
    const dataSize = sampleCount * channels * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(offset, value) {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    }

    let offset = 0;
    writeString(offset, "RIFF");
    offset += 4;
    view.setUint32(offset, 36 + dataSize, true);
    offset += 4;
    writeString(offset, "WAVE");
    offset += 4;
    writeString(offset, "fmt ");
    offset += 4;
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, channels, true);
    offset += 2;
    view.setUint32(offset, rate, true);
    offset += 4;
    view.setUint32(offset, rate * channels * (bitsPerSample / 8), true);
    offset += 4;
    view.setUint16(offset, channels * (bitsPerSample / 8), true);
    offset += 2;
    view.setUint16(offset, bitsPerSample, true);
    offset += 2;
    writeString(offset, "data");
    offset += 4;
    view.setUint32(offset, dataSize, true);
    offset += 4;

    return new Uint8Array(buffer);
  }

  const originalFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  const silentBackTrack = createSilentWav(1);

  if (originalFetch) {
    window.fetch = function (input, init) {
      var url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input && typeof input.url === "string") {
        url = input.url;
      }

      if (url.indexOf("audio/back.mp3") !== -1) {
        return Promise.resolve(
          new Response(silentBackTrack.slice(), {
            status: 200,
            headers: {
              "Content-Type": "audio/wav",
            },
          })
        );
      }

      return originalFetch(input, init);
    };
  }

  function restyleSplash(playground) {
    if (!playground) {
      return;
    }

    const title = playground.querySelector(".splash .title");
    if (title) {
      title.textContent = "Gulu Goose";
    }

    const nerd = playground.querySelector(".splash .nerd");
    if (nerd) {
      nerd.textContent = "Gulu Goose";
      nerd.style.left = "0";
      nerd.style.right = "0";
      nerd.style.width = "100%";
      nerd.style.textAlign = "center";
    }

    const credits = playground.querySelector(".splash .credits");
    if (credits) {
      credits.remove();
    }

    const soundStatus = playground.querySelector(".sound-status");
    if (soundStatus && !soundStatus.classList.contains("on")) {
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyS",
        key: "s",
      });

      try {
        Object.defineProperty(event, "keyCode", { get: function () { return 83; } });
        Object.defineProperty(event, "which", { get: function () { return 83; } });
      } catch (error) {
        void error;
      }

      document.body.dispatchEvent(event);
    }
  }

  window.addEventListener("load", function () {
    setTimeout(function () {
      restyleSplash(document.querySelector(".js-pacman-playground"));
    }, 0);
  });
})();
