const aws = require("aws-sdk")
const ec2 = new aws.EC2()
const axios = require("axios")


exports.handler = async (event, context) => {
  if(event["token"] != process.env.VERIFY_TOKEN) {
    return { statusCode: 400, body: "invalid verification token" }
  }
    
  if(!process.env.ALLOWED_USERS.split(",").includes(event["user"]["id"])) {
    return { statusCode: 400, body: "non-allowed user" }
  }
  
  let res
  if (event["callback_id"] == "add") {
    res = await addRule(
      event["submission"]["securityGroup"], 
      event["submission"]["ipAddress"], 
      event["submission"]["comment"]
    )
  } else {
    res = await removeRule(
      event["submission"]["securityGroup"], 
      event["submission"]["ipAddress"]
    )
  }

  const res2 = await postResult(event, res)

  return { }
};


async function addRule(groupId, ipAddress, comment) {
  const params = {
    GroupId: groupId, 
    IpPermissions: [
      {
        FromPort: 22,
        ToPort: 22,
        IpProtocol: "tcp", 
        IpRanges: [
          {
            CidrIp: `${ipAddress}/32`, 
            Description: comment
          }
        ]
      }
    ]
  }
  return ec2.authorizeSecurityGroupIngress(params).promise()
    .then(function(data) {
      return true
    }).catch(function (err) {
      console.error(err)
      return
    })
}

async function removeRule(groupId, ipAddress) {
  const params = {
    GroupId: groupId, 
    IpPermissions: [
      {
        FromPort: 22,
        ToPort: 22,
        IpProtocol: "tcp", 
        IpRanges: [
          {
            CidrIp: `${ipAddress}/32`
          }
        ]
      }
    ]
  }
  return ec2.revokeSecurityGroupIngress(params).promise()
    .then(function(data) {
      return true
    }).catch(function (err) {
      console.error(err)
      return
    })
}

async function getGroup(groupId) {
  return ec2.describeSecurityGroups({"GroupIds": [groupId]}).promise().then(function(data) {
    return data
  })
}

async function postResult(event, res) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Authorization": `Bearer ${process.env.SLACK_TOKEN}`
  }
  const groups = await getGroup(event["submission"]["securityGroup"])
  let body = {
    "channel": "#ip_address_changer",
    "icon_emoji": ":hammer:",
    "text": "",
    "attachments": [
      {
        "color": "#36a64f",
        "author_name": "IPアドレスの追加/削除",
        "fields": [
          {
            "title": "■ Executed By",
            "value": event["user"]["name"],
            "short": false
          },
          {
            "title": "■ Action",
            "value": event["callback_id"],
            "short": false
          },
          {
            "title": "■ Security Group",
            "value": groups["SecurityGroups"][0]["GroupName"],
            "short": false
          },
          {
            "title": "■ Ip Address",
            "value": event["submission"]["ipAddress"],
            "short": false
          },
          {
            "title": "■ Comment",
            "value": event["submission"]["comment"],
            "short": false
          }
        ]
      }
    ]
  }
  if (res) body["text"] = "Success."
  else body["text"] = "Something went wrong."
  
  return axios.post("https://slack.com/api/chat.postMessage", body, {"headers":headers})
    .then(function (response) {
      return response.data;
    }).catch(function (err) {
      console.error(err)
      return
    }) 
}

