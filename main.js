import { AbilityHelper } from "./ability-helper.js";
import { ResourceHelper } from "./resource-helper.js";
import { SystemHelper } from "./system-helper.js";
import {SocketHelper} from "./socket-helper.js";

const abilityHelper = new AbilityHelper();
const socketHelper = new SocketHelper();
let socket;

//SocketLib; Required for editing chat messages as users for rolls.
Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerModule("draw-steel-helper");
	socket.register("deleteMessage", SocketHelper.deleteMessage);
	socket.register("updateMessage", SocketHelper.updateMessage);
});

// Replace Conditions with Draw Steel variants.
Hooks.on("init", SystemHelper.replaceConditionList);

// Automatically roll for resource on turn start.
Hooks.on("updateCombat", ResourceHelper.rollResourceGainOnTurnStart);
Hooks.on("combatRound", ResourceHelper.getMaliceOnRoundStart);
Hooks.on("combatStart", ResourceHelper.getMaliceOnRoundStart);

// Add functionalities to the chat buttons.
Hooks.on("renderChatMessage", async (message, html) => {
  if (message.flags.applyDamage) {
    html.find("button#damageButton")
    .off()
    .on("click", async (evt) => {
        evt.preventDefault();
        abilityHelper.applyDamage(message);
        // await message.update({content: "This is a test"});
    });
    html.find("button#halfDamageButton")
        .off()
        .on("click", async (evt) => {
          evt.preventDefault();
          abilityHelper.applyDamage(message, true);
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
              await abilityHelper.rollAbility(message, socket);
          });
  }
});

Hooks.on("renderChatMessage", (message, html) => ResourceHelper.onClickGainResourceButton(message, html, socket));


// Allow us to use the functions within Foundry itself as well. Required for a few fields inside the Module.
// Never ever remove this until we are absolutely sure this isn't used anywhere anymore.
window.DrawSteelHelper = new AbilityHelper();

