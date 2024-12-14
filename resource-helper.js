
// Manages the logic that handles resources + malice.
export class ResourceHelper {
    async rollResourceGainOnTurnStart(combat) {
        if (!game.user.isGM) {
            return;
        }

        const currentActor = combat.combatant.actor;
        const currentActorProps = currentActor.system.props;

        if (!!currentActorProps?.mcdm_class_name) {
            let roll = await new Roll(currentActorProps?.mcdm_resource_turn ?? "1d3").evaluate({ async: true});

            const flavorText = currentActorProps?.mcdm_resource_turn_flavor ?? ` gains ${currentActorProps?.mcdm_resource}`;
            
            const html = 
            `
                <hr><pg>${await roll.render()}</pg>
                <hr><button id="gainResourceButton">Gain ${roll.total} ${currentActorProps?.mcdm_resource}</button>
            `

            roll.toMessage({
                flavor: `<h3><strong>${currentActor.name} ${flavorText}</h3></strong>`,
                rollMode: game.settings.get("core", "rollMode"),
                speaker: {
                    alias: currentActor.name,
                    actor: game.actors.getName(currentActor.name)
                },
                flags: {
                    addResource: {
                        actorId: currentActor.id,
                        amount: roll.total,
                        resourceName: currentActorProps?.mcdm_resource,
                    },
                },
                content: html,
            });
        }
    }
    
    async onClickGainResourceButton(message, html, socket) {
        html.find("button#gainResourceButton")
            .off()
            .on("click", async (evt) => {
                evt.preventDefault();
                await this.addResources(message, socket);
            });
    }
    
    async addResources(message, socket) {
        console.log("Pressed button!")
        
        const flags = message.flags.addResource;
        const actor = game.actors.find(x => x.id === flags.actorId);
        
        if (Number.isNaN(flags.amount)) {
            ui.notifications.error("Tried to add a NaN to an actor's resource");
            throw "Tried to add a NaN to an actor's resource";
        }

        const newResourceAmount = Number(actor.system.props.mcdm_resource_current) + Number(flags.amount);
        
        const updatedData = {
            system: {
                props: {
                    mcdm_resource_current: Number(actor.system.props.mcdm_resource_current) + Number(flags.amount),
                }
            }
        }
        
        await actor.update(updatedData);
        
        let disabledButtonHtml = message.content.replace(
            /<button id="gainResourceButton"[^>]*>.*?<\/button>/,
            '<button id="gainResourceButton" disabled>Gained!</button>'
        );
        
        await socket.executeAsGM("updateMessage", message.id, {...message, content: disabledButtonHtml})

        const messageData = {
            content: `<div>${actor.name} gained ${flags.amount} ${flags.resourceName}, he now has ${newResourceAmount}!</div>`
        };

        ChatMessage.create(messageData);
        
    }
    
    async getMaliceOnRoundStart(combat) {
        if (!game.user.isGM) {
            // Non-GMs don't gain malice.
            return;
        }
        
        const combatants = combat.combatants;
        const playerCombatants = combatants.filter(combatant => !!combatant.actor.system.props?.mcdm_class_name);
        const allVictories = playerCombatants.reduce((sum, combatant) => sum + (+combatant.actor.system.props?.mcdm_victories_current ?? 0), 0);
        const avgVictories = Math.floor(allVictories / playerCombatants.length);

        const malice = playerCombatants.length + avgVictories + combat.round + 1; // Combat round is zero indexed;

        const messageData = {
            flavor: `<h3><strong>The Battle Intensifies!</h3></strong>`,
            content: `<div>Enemies brim with dark intent as they gain <b>${malice}</b> Malice!</div>`
        };

        ChatMessage.create(messageData);
    }
}