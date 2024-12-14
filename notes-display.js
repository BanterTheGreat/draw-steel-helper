export class NotesDisplay {

    static refreshToken(token, flags) {
        game.notesDisplay._handleOverlay(token, token.hover);
    }

    static onCanvasReady() {
        canvas.tokens?.placeables.forEach((token) => {
            game.notesDisplay._handleOverlay(token, true);
        });
    }
    
    static onUpdateActor(actor, data, options, userId) {
        // Get all the tokens because there can be two tokens of the same linked actor.
        const tokens = canvas.tokens?.placeables.filter((token) => token?.actor?.id === actor.id);
        // Call the _handleOverlay method for each token.
        tokens?.forEach((token) => game.notesDisplay._handleOverlay(token, true));
    }
    
    static onUpdateToken(token, data, options, userId) {
        if (data?.flags && data.flags["token-notes"]) {
            console.error(token);
            // Get all the tokens because there can be two tokens of the same linked actor.
            const tokens = canvas.tokens?.placeables.filter((canvasToken) => canvasToken?.actor?.id === token.actorId);
            // Call the _handleOverlay method for each token.
            tokens?.forEach((canvasToken) => game.notesDisplay._handleOverlay(canvasToken));
        }
    }
    
    get gridScale() {
        return 1;
    }
    
    get fontSize() {
        return 18;
    }

    get scaledFontSize() {
        return (this.fontSize * this.gridScale) * 4;
    }

    _handleOverlay(token, hovering = false) {
        // Create PIXI
        try {
            // We hide the note while hovering over a token.
            const { desc, color, stroke } = { desc: token?.document.flags["token-notes"]?.notes ?? "", color: "#ffffff", stroke: "#000000" };
            if (desc !== undefined && color && stroke) {
                const { width } = token.getSize();
                const y = -2 + 35; // 25 = this.height;
                const position = 2;
                const x = (width / 2) * position;
                const config = { desc, color, stroke, width, x, y };
                if (!token.notesDisplay?._texture) {
                    this._createNotesDisplay(token, config, hovering);
                } else {
                    this._updateNotesDisplay(token, config, hovering);
                }
            }
        } catch(err) {
            console.error(
                `Notes Display | Error on function _handleOverlay(). Token Name: "${token.name}". ID: "${token.id}". Type: "${token.document.actor.type}".`,
                err
            );
        }
    }

    _createNotesDisplay(token, config = {}, hovering = false) {
        const { desc, color, stroke, width, x, y } = config;
        const padding = 5;
        const style = {
            // Multiply font size to increase resolution quality
            fontSize: this.scaledFontSize,
            fontFamily: "Signika",
            fill: color,
            stroke: stroke,
            strokeThickness: 12,
            padding: padding,
            align: "center",
            dropShadow: true,
            dropShadowColor: "black",
            lineJoin: "round",
        };
        
        token.notesDisplay = token.addChild(new PIXI.Text(desc, style));
        token.notesDisplay.scale.set(0.25);
        token.notesDisplay.anchor.set(0.5, 1);
        
        var lineCount = desc.split("\n").length - 1;
        token.notesDisplay.position.set(width / 2, x + y + (lineCount * (this.fontSize + padding)) + (hovering ? 24 : 0));
    }

    _updateNotesDisplay(token, config = {}, hovering = false) {
        const { desc, color, stroke, width, x, y } = config;
        const padding = 5;
        token.notesDisplay.style.fontSize = this.scaledFontSize;
        token.notesDisplay.text = desc;
        token.notesDisplay.style.fill = color;
        token.notesDisplay.style.stroke = stroke;
        token.notesDisplay.visible = true;
        
        var lineCount = desc.split("\n").length - 1;
        token.notesDisplay.position.set(width / 2, x + y + (lineCount * (this.fontSize + padding)) + (hovering ? 24 : 0));
    }
}