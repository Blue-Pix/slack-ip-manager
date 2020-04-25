const aws = require("aws-sdk")
const ec2 = new aws.EC2()
const axios = require("axios")


exports.handler = async (event, context) => {
  
  if(event["token"] != process.env.VERIFY_TOKEN) {
    return { statusCode: 400, body:`invalid verification token` }
  }
    
  if(!process.env.ALLOWED_USERS.split(",").includes(event['user_id'])) {
    return { statusCode: 400, body: `non-allowed user` }
  }
  
  const command = event["text"] === undefined ? "" : event["text"].split("+")[0]
  let res
  if (command == "add") res = await openAddMenu(event)
  else if (command == "remove") res = await openRemoveMenu(event)
  else return { statusCode: 400, body: "type `/ip add` or `/ip remove`" }
      
  if(!res || !res["ok"]) return { statusCode: 400, body: "something went wrong." }
  return { statusCode: 200 }
};

async function openAddMenu(event) {
  const body = await buildAddMenuBody(event["trigger_id"])
  return await openMenu(body)
}

async function openRemoveMenu(event) {
  const body = await buildRemoveMenuBody(event["trigger_id"])
  return await openMenu(body)
}

async function openMenu(body) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Authorization": `Bearer ${process.env.SLACK_TOKEN}`
  }
  const res = await axios.post('https://slack.com/api/dialog.open', body, {"headers":headers})
    .then(function (response) {
      console.log(response.data)
      return response.data
    }).catch(function (err) {
      console.error(err)
      return
    }) 
  return res
}

async function getGroup() {
  return ec2.describeSecurityGroups({"GroupIds": process.env.ALLOWED_SGS.split(",")}).promise().then(function(data) {
    return data
  })
}

async function buildAddMenuBody(triggerId) {
  const groups = await getGroup()
  return {
    "trigger_id": triggerId,
    "dialog": {
      "callback_id": "add",
      "title": "ssh接続元許可IPアドレスの追加",
      "notify_on_cancel": false,
      "elements": [
        {
          "type": "select",
          "label": "Security Group",
          "name": "securityGroup",
          "options": groups["SecurityGroups"].map(group => {
            return {
              "value": group["GroupId"],
              "label": group["GroupName"]
            }
          })
        },  
        {
          "type": "text",
          "label": "IP Address",
          "name": "ipAddress"
        },
        {
          "type": "text",
          "label": "Comment",
          "name": "comment"
        }
      ]
    }
  }
}

async function buildRemoveMenuBody(triggerId) {
  const groups = await getGroup()
  return {
    "trigger_id": triggerId,
    "dialog": {
      "callback_id": "remove",
      "title": "ssh接続元許可IPアドレスの削除",
      "notify_on_cancel": false,
      "elements": [
        {
          "type": "select",
          "label": "Security Group",
          "name": "securityGroup",
          "options": groups["SecurityGroups"].map(group => {
            return {
              "value": group["GroupId"],
              "label": group["GroupName"]
            }
          })
        },  
        {
          "type": "text",
          "label": "IP Address",
          "name": "ipAddress"
        }
      ]
    }
  }
}

