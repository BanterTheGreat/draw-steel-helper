import { DrawSteelHelper } from "./DrawSteelHelper.js";
import { EnemyImporter } from "./EnemyImporter.js";

const drawSteelHelper = new DrawSteelHelper();
let socket;

//SocketLib; Required for editing chat messages as users for rolls.
Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerModule("draw-steel-helper");
	socket.register("deleteMessage", drawSteelHelper.deleteMessage);
	socket.register("updateMessage", drawSteelHelper.updateMessage);
});

// Replace Conditions with Draw Steel variants.
Hooks.on("init", () => {
  const effectsToDelete = [
    'unconscious',
    'sleep',
    'stun',
    'prone',
    'restrain',
    'paralysis',
    'deaf',
    'silence',
    'fear',
    'burning',
    'frozen',
    'shock',
    'corrode',
    'bleeding',
    'disease',
    'poison',
    'curse',
    'regen',
    'degen',
    'upgrade',
    'downgrade',
    'target',
    'eye',
    'bless',
    'fireShield',
    'coldShield',
    'magicShield',
    'holyShield'
  ];

  const newEffects = [
    {id: 'bleeding', name: 'Bleeding', img: 'icons/svg/blood.svg'},
    {id: 'dazed', name: 'Dazed', img: 'icons/svg/daze.svg'},
    {id: 'frightened', name: 'Frightened', img: 'icons/svg/terror.svg'},
    {id: 'grabbed', name: 'Grabbed', img: 'icons/svg/net.svg'},
    {id: 'prone', name: 'Prone', img: 'icons/svg/falling.svg'},
    {id: 'restrained', name: 'Restrained', img: 'icons/svg/net.svg'},
    {id: 'slowed', name: 'Slowed', img: 'icons/svg/degen.svg'},
    {id: 'taunted', name: 'Taunted', img: 'icons/svg/target.svg'},
    {id: 'weakened', name: 'Weakened', img: 'icons/svg/poison.svg'},
    {id: 'judged', name: 'Judged', img: 'icons/svg/bones.svg'},
    {id: 'stats-down', name: 'Stats Down', img: 'icons/svg/stoned.svg'},
    {id: 'stats-up', name: 'Stats Up', img: 'icons/svg/sword.svg'}
  ];

  CONFIG.statusEffects = CONFIG.statusEffects.filter(x => !effectsToDelete.includes(x.id));

    CONFIG.statusEffects = CONFIG.statusEffects.concat(newEffects);
});

// Automatically roll for resource on turn start.
Hooks.on("updateCombat", async (combat) => {
  drawSteelHelper.triggerResourceRoll(combat);
});

// Automatically display gained Malice on round start.
Hooks.on("combatRound", async (combat) => {
  if (!game.user.isGM) {
    return;
  }

  drawSteelHelper.getMalice(combat);
});

// Automatically display gained Malice on combat start.
Hooks.on("combatStart", async (combat) => {
  if (!game.user.isGM) {
    return;
  }

  drawSteelHelper.getMalice(combat);
});

// Add functionalities to the chat buttons.
Hooks.on("renderChatMessage", async (message, html) => {
  if (message.flags.applyDamage) {
    html.find("button#damageButton")
    .off()
    .on("click", async (evt) => {
        evt.preventDefault();
        drawSteelHelper.applyDamage(message);
        // await message.update({content: "This is a test"});
    });

    // Annoyingly, the message contains both flags but we only really want to apply one.
    return;
  }
  if (message.flags.abilityRoller) {
      html.find("button#rollButton")
          .off()
          .on("click", async (evt) => {
              evt.preventDefault();
              await drawSteelHelper.rollAbility(message, socket);
          });
  }
});

// Allow us to use the functions within Foundry itself as well. Required for a few fields inside the Module.
window.DrawSteelHelper = new DrawSteelHelper();