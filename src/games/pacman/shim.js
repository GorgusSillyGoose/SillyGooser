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
  const keyRemap = {
    KeyW: { code: "ArrowUp", key: "ArrowUp", keyCode: 38 },
    KeyA: { code: "ArrowLeft", key: "ArrowLeft", keyCode: 37 },
    KeyS: { code: "ArrowDown", key: "ArrowDown", keyCode: 40 },
    KeyD: { code: "ArrowRight", key: "ArrowRight", keyCode: 39 },
    KeyM: { code: "KeyS", key: "s", keyCode: 83 },
  };

  function dispatchVirtualKey(target, mapping, sourceEvent) {
    const eventType = sourceEvent?.type || "keydown";
    const event = new KeyboardEvent(eventType, {
      bubbles: true,
      cancelable: true,
      composed: true,
      code: mapping.code,
      key: mapping.key,
      repeat: Boolean(sourceEvent?.repeat),
      altKey: Boolean(sourceEvent?.altKey),
      ctrlKey: Boolean(sourceEvent?.ctrlKey),
      metaKey: Boolean(sourceEvent?.metaKey),
      shiftKey: Boolean(sourceEvent?.shiftKey),
      location: sourceEvent?.location || 0,
    });

    try {
      Object.defineProperty(event, "keyCode", { get: function () { return mapping.keyCode; } });
      Object.defineProperty(event, "which", { get: function () { return mapping.keyCode; } });
    } catch (error) {
      void error;
    }

    target.dispatchEvent(event);
  }

  function remapKeyEvent(event) {
    if (!event || !event.isTrusted) {
      return false;
    }

    const mapping = keyRemap[event.code];
    if (!mapping) {
      return false;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchVirtualKey(document.body, mapping, event);
    return true;
  }

  window.addEventListener("keydown", remapKeyEvent, true);
  window.addEventListener("keyup", remapKeyEvent, true);

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
      title.style.position = "absolute";
      title.style.top = "12.04%";
      title.style.left = "0";
      title.style.right = "0";
      title.style.textAlign = "center";
      title.style.color = "#FCB644";
      title.style.fontSize = "2em";
    }

    const start = playground.querySelector(".splash a.start");
    if (start) {
      start.style.position = "relative";
      start.style.top = "21%";
      start.style.textTransform = "uppercase";
      start.style.fontSize = "1.6em";
    }

    const nerd = playground.querySelector(".splash .nerd");
    if (nerd) {
      nerd.remove();
    }

    const p2Score = playground.querySelector(".splash .p2-score");
    if (p2Score) {
      p2Score.remove();
    }

    const credits = playground.querySelector(".splash .credits");
    if (credits) {
      credits.remove();
    }

    playground.querySelectorAll(".splash p span").forEach((span) => {
      span.style.color = "#FCB644";
    });

    const soundStatus = playground.querySelector(".sound-status");
    if (soundStatus && !soundStatus.classList.contains("on")) {
      dispatchVirtualKey(document.body, keyRemap.KeyM);
    }
  }

  window.addEventListener("load", function () {
    setTimeout(function () {
      restyleSplash(document.querySelector(".js-pacman-playground"));
    }, 0);
  });
})();
