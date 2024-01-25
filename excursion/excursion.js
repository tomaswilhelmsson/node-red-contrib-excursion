var https = require('https');

module.exports = function(RED) {
    function ExcursionNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.time = config.time;
        node.timeout_time = config.timeout_time;
        node.hardmax = isNaN(config.hardmax) ? null : Number(config.hardmax);
        node.softmax = isNaN(config.softmax) ? null : Number(config.softmax);
        node.softmin = isNaN(config.softmin) ? null : Number(config.softmin);
        node.hardmin = isNaN(config.hardmin) ? null : Number(config.hardmin);

        node.timeout = null;
        node.output_timeout = null;
        node.lastMsg = null;
        node.inExcursion = false;

        node.status({fill:"blue",shape:"ring",text:"Waiting for data"});

        function startOutputTimer() {
            if( node.output_timeout == null ) {
                if (node.timeout_time) { // if there's a time set
                    node.log("Starting " + node.time + " second timer for output");
                    var delayMs = 1000 * node.timeout_time;
                    node.output_timeout = setTimeout(reportTimeout, delayMs);
                }
            }
        }

        function startTimer() {
            if( node.timeout == null ) {
                if (node.time) { // if there's a time set
                    node.log("Starting " + node.time + " second timer");
                    var delayMs = 1000 * node.time;
                    node.timeout = setTimeout(reportSoftExcursion, delayMs);
                } else { // otherwise just report now
                    reportSoftExcursion();
                }
            }
        }

        function stopTimer() {
            if( node.timeout != null ) {
                node.log("Stopping timer");
                clearTimeout(node.timeout);
                node.timeout = null;
            }
        }

        function stopOutputTimer() {
            if(node.output_timeout != null) {
                node.log("Stopping output timer");
                clearTimeout(node.output_timeout);
                node.output_timeout = null;
            }
        }

        function reportTimeout() {
            node.status({fill:"red",shape:"dot",text:"timeout"});
            stopOutputTimer();
            node.send([null, null, true]);
            setTimeout(() => {
                node.send([null, null, false])
            }, 1000);
        }

        function reportExcursion(soft) {
            node.status({fill:"red",shape:"dot",text:"Excursion! (" + node.lastMsg.payload + ")"});
            stopTimer();
            startOutputTimer();
            node.inExcursion = true;
            if(soft)
                node.send([node.lastMsg, null]);
            else
                node.send([null, node.lastMsg, null]);
        }

        function valueIsOutsideSoftLimits(value) {
            if( isNaN(value) ) {
                return true;
            }
            value = Number(value);
            if( node.softmax && value > node.softmax ) {
                return true;
            }
            if( node.softmin && value < node.softmin ) {
                return true;
            }
            return false;
        }

        function valueIsOutsideHardLimits(value) {
            if( isNaN(value) ) {
                return true;
            }
            value = Number(value);
            if( node.hardmax && value > node.hardmax ) {
                return true;
            }
            if( node.hardmin && value < node.hardmin ) {
                return true;
            }
            return false;
        }

        this.on('input', function(msg) {
            node.lastMsg = msg;
            var current = msg.payload;

            if( valueIsOutsideHardLimits(current) ) {
                node.log("Value exceeds hard limits: " + current);
                reportExcursion(false);
            } else if( valueIsOutsideSoftLimits(current) ) {
                node.log("Value exceeds soft limits: " + current);
                if (node.inExcursion) {
                    reportExcursion(true);
                } else {
                    node.status({fill:"yellow",shape:"dot",text:"Soft excursion... (" + current + ")"});
                    startTimer();
                }
            } else {
                node.status({fill:"green",shape:"dot",text:"OK (" + current + ")"});
                node.inExcursion = false;
                stopTimer();
            }
        });

        this.on('close', function() {
            stopTimer();
        });
    };

    RED.nodes.registerType("excursion",ExcursionNode, { });
};