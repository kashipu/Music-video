/**
 * Stub for YouTube IFrame API to simulate video playback without network requests.
 */
export const ytStubScript = `
  (function() {
    const players = {};
    window.__ytTest = {
      lastLoaded: null,
      fire: (arg1, arg2, arg3) => {
        let elemId = 'yt-player';
        let evtName, data;
        if (arg3 !== undefined) {
          elemId = arg1;
          evtName = arg2;
          data = arg3;
        } else {
          evtName = arg1;
          data = arg2;
        }
        console.log('[ytStub] fire:', elemId, evtName, data);
        const handlers = players[elemId]?.handlers;
        if (!handlers) return;
        if (evtName === 'state') { players[elemId].state = data; handlers.onStateChange?.({ data }); }
        if (evtName === 'error') { handlers.onError?.({ data }); }
      },
      getState: (elemId = 'yt-player') => players[elemId]?.state ?? -1,
      getLoadedVideo: (elemId) => {
        if (!elemId) {
          console.log('[ytStub] getLoadedVideo (any) returning:', window.__ytTest.lastLoaded);
          return window.__ytTest.lastLoaded;
        }
        const v = players[elemId]?._loaded;
        console.log('[ytStub] getLoadedVideo for', elemId, 'returning:', v);
        return v;
      },
    };
    window.YT = {
      Player: function(elemId, opts) {
        console.log('[ytStub] Player initialized for', elemId);
        const playerHandlers = {
          onReady: opts.events?.onReady,
          onStateChange: opts.events?.onStateChange,
          onError: opts.events?.onError
        };
        players[elemId] = { handlers: playerHandlers, state: -1, _loaded: null };

        const player = {
          loadVideoById: (id) => { 
            console.log('[ytStub]', elemId, 'loadVideoById:', id);
            players[elemId]._loaded = id; 
            window.__ytTest.lastLoaded = id;
            players[elemId].state = 1; 
            playerHandlers.onStateChange?.({ data: 1 }); 
          },
          cueVideoById: (id) => { 
            console.log('[ytStub]', elemId, 'cueVideoById:', id);
            players[elemId]._loaded = id; 
            players[elemId].state = 5; 
            playerHandlers.onStateChange?.({ data: 5 }); 
          },
          playVideo: () => { 
            console.log('[ytStub]', elemId, 'playVideo');
            players[elemId].state = 1; 
            playerHandlers.onStateChange?.({ data: 1 }); 
          },
          pauseVideo: () => { 
            console.log('[ytStub]', elemId, 'pauseVideo');
            players[elemId].state = 2; 
            playerHandlers.onStateChange?.({ data: 2 }); 
          },
          stopVideo: () => { 
            console.log('[ytStub]', elemId, 'stopVideo');
            players[elemId].state = 0; 
            playerHandlers.onStateChange?.({ data: 0 });
          },
          getPlayerState: () => players[elemId].state,
          getCurrentTime: () => 30,
          getDuration: () => 200,
          seekTo: () => {}, 
          setVolume: () => {}, 
          mute: () => {}, 
          unMute: () => {}, 
          isMuted: () => false,
        };
        setTimeout(() => {
            console.log('[ytStub]', elemId, 'Triggering onReady');
            playerHandlers.onReady?.();
        }, 50);
        return player;
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5, UNSTARTED: -1 },
    };
    // Block the real iframe_api script so it doesn't override our stub
    const orig = document.createElement;
    document.createElement = function(tag) {
      const el = orig.call(document, tag);
      if (tag === 'script') {
        Object.defineProperty(el, 'src', {
          set(v) { if (v && v.includes('youtube.com/iframe_api')) { console.log('[ytStub] Blocked real YouTube API'); return; } this._src = v; },
          get() { return this._src; },
        });
      }
      return el;
    };
    console.log('[ytStub] Stub injected');
  })();
`;
