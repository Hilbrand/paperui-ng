const demoItems=[{statusInfo:{status:"ONLINE",statusDetail:"NONE"},editable:!0,label:"Generic MQTT Thing",bridgeUID:"mqtt:systemBroker:embedded-mqtt-broker",configuration:{},properties:{},UID:"mqtt:topic:3edb5737",thingTypeUID:"mqtt:topic",channels:[{linkedItems:["mqtt_topic_3edb5737_testtext"],uid:"mqtt:topic:3edb5737:testtext",id:"testtext",channelTypeUID:"mqtt:String",itemType:"String",kind:"STATE",label:"Test Text",defaultTags:[],properties:{},configuration:{stateTopic:"test/text"}},{linkedItems:["mqtt_topic_3edb5737_testnumber"],uid:"mqtt:topic:3edb5737:testnumber",id:"testnumber",channelTypeUID:"mqtt:Number",itemType:"Number",kind:"STATE",label:"Test number",defaultTags:[],properties:{},configuration:{commandTopic:"test/number/set",stateTopic:"test/number",step:1}},{linkedItems:["mqtt_topic_3edb5737_testswitch"],uid:"mqtt:topic:3edb5737:testswitch",id:"testswitch",channelTypeUID:"mqtt:Switch",itemType:"Switch",kind:"STATE",label:"Test switch",defaultTags:[],properties:{},configuration:{commandTopic:"test/switch/set",stateTopic:"test/switch"}},{linkedItems:["mqtt_topic_3edb5737_multistate"],uid:"mqtt:topic:3edb5737:multistate",id:"multistate",channelTypeUID:"mqtt:EnumSwitch",itemType:"Switch",kind:"STATE",label:"Multi State",defaultTags:[],properties:{},configuration:{allowedStates:"AAA,BBB,CCC",commandTopic:"test/multi/set",stateTopic:"test/multi"}}]},{statusInfo:{status:"UNINITIALIZED",statusDetail:"HANDLER_CONFIGURATION_PENDING"},editable:!0,label:"testname (HomeAssistant MQTT Switch)",bridgeUID:"mqtt:systemBroker:embedded-mqtt-broker",configuration:{baseid:"homeassistant",nodeid:"node",deviceid:"testobject-node",objectid:"testobject"},properties:{basetopic:"homeassistant"},UID:"mqtt:homeassistant:embedded-mqtt-broker:testobject-node",thingTypeUID:"mqtt:homeassistant",channels:[]},{statusInfo:{status:"ONLINE",statusDetail:"NONE"},editable:!0,label:"MQTT Broker",configuration:{},properties:{password:"",brokerid:"embedded-mqtt-broker",qos:"0",port:"1883.0",retain:"false",keep_alive_time_ms:"60",host:"127.0.0.1",reconnect_time_ms:"10000",lastwill:"",url:"127.0.0.1:1883",username:""},UID:"mqtt:systemBroker:embedded-mqtt-broker",thingTypeUID:"mqtt:systemBroker",channels:[]}],demoThingTypes=[{UID:"mqtt:topic",label:"Generic MQTT Thing",description:"Add different types of channels, linked to MQTT topics, to this Thing",listed:!0,supportedBridgeTypeUIDs:["mqtt:broker","mqtt:systemBroker"],bridge:!1},{UID:"mqtt:homeassistant",label:"A HomeAssistant MQTT Component",description:"This thing represents a HomeAssistant MQTT Component",listed:!0,supportedBridgeTypeUIDs:["mqtt:broker","mqtt:systemBroker"],bridge:!1},{UID:"mqtt:homie300",label:"A Homie (version 3.x) device",description:"This thing represents a MQTT Homie device",listed:!0,supportedBridgeTypeUIDs:["mqtt:broker","mqtt:systemBroker"],bridge:!1},{UID:"mqtt:broker",label:"MQTT Broker",description:"A connection to a MQTT broker",listed:!0,supportedBridgeTypeUIDs:[],bridge:!0},{UID:"mqtt:systemBroker",label:"System MQTT Broker",description:"A system configured and therefore read-only broker connection. Properties are reflecting the configuration and internal connection status.",listed:!0,supportedBridgeTypeUIDs:[],bridge:!0}],schema={uri:"http://openhab.org/schema/things-schema.json",fileMatch:["http://openhab.org/schema/things-schema.json"],schema:{type:"array",items:{$ref:"#/definitions/item"},definitions:{item:{type:"object",description:"An openHAB thing",required:["UID","thingTypeUID","label"],properties:{link:{type:"string",description:"Internal URI information for openHAB REST clients"},editable:{type:"boolean",description:"Items defined via old .item files are not editable"},UID:{type:"string",description:"A unique ID for this thing",minLength:2},label:{type:"string",description:"A friendly name",minLength:2},tags:{type:"array",uniqueItems:!0,description:"Tags of this item"}}}}}},ThingsMixin={methods:{statusinfo:function(t){return t.statusInfo?t.statusInfo.status.toLowerCase().replace(/^\w/,t=>t.toUpperCase()):"Unknown"},statusDetails:function(t){return t.statusInfo?t.statusInfo.statusDetail:""},statusmessage:function(t){return t.statusInfo?t.statusInfo.message:""},statusBadge:function(t){switch(t.statusInfo?t.statusInfo.status:""){case"ONLINE":return"badge badge-success";case"OFFLINE":return"badge badge-danger";case"UNINITIALIZED":return"badge badge-info"}return"badge badge-light"},description(t){for(const e of demoThingTypes)if(e.UID==t.thingTypeUID)return e.description;return"No Thing description available"},getActions:t=>({Disable:"Disable this thing","Start pairing":"This thing requires a special pairing method",Unpair:"Removes the association to the remote device"}),triggerAction(t){console.log("triggered",t.target.dataset.uid,t.detail)}}};window.loadThings=function(t){calledOnce=!0,t.start([ThingsMixin],"http://openhab.org/schema/things-schema.json",schema,["link","editable","statusInfo","properties"]),t.items=demoItems};var calledOnce=!1,el=document.getElementById("thingsapp");el&&!calledOnce&&loadThings(el);