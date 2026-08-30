(function(){
"use strict";

/* ============ demo record ============ */
var D = {
  name:"Nadine", full:"Nadine Finge", order:"#57668", date:"17 May 2026",
  item:"Graciell Warm Terracotta Bench", qty:1,
  was:"1,522.50 AED", now:"1,450.00 AED", sub:"1,450.00 AED", ship:"0.00 AED",
  exvat:"1,380.95 AED", vat:"69.05 AED", total:"1,450.00 AED", saved:"72.50 AED",
  addr:"Furjan – Zone A – Quortaj 4<br>164<br>Dubai DU<br>United Arab Emirates",
  shipMethod:"Standard UAE", payMethod:"Tap Payments",
  eta:"7 to 9 working days", awb:"AWB 7714 8820 331", courier:"HomeKode Logistics",
  ticket:"FD-48210", slot:"Tue 26 Aug, 10am – 1pm", fc:"Dubai Fulfilment Centre"
};

/* ============ reason sets ============ */
var R_RETURN = [
  ["damaged","Damaged Item","the piece arrived with damage"],
  ["missing","Missing Parts","some parts were missing from the box"],
  ["wrong","Wrong Item Delivered","the item delivered wasn't the one ordered"],
  ["delivery","Delivery Issue","there was an issue with the delivery"],
  ["mind","Customer Changed Mind","you've changed your mind about the piece"],
  ["install","Installation / Assembly Issue","the assembly didn't go as it should"],
  ["expect","Product Not as Expected","the piece wasn't what you expected"],
  ["size","Size / Measurements Issue","the measurements didn't work for your space"],
  ["quality","Product Quality Issue","the quality wasn't up to standard"],
  ["colour","Colour Mismatch","the colour didn't match what you ordered"],
  ["desc","Product Description Mismatch","the piece didn't match its description"],
  ["dirty","Dirty Item","the piece arrived unclean"],
  ["other","Other","of the reason you shared with our team"]
];
var R_HOLD = [
  ["stock","Stock verification","We're confirming the piece is reserved and ready in the right condition before it moves."],
  ["payment","Payment verification","Your payment is being confirmed by the provider. This is routine and usually clears quickly."],
  ["address","Address needs confirming","We want to be certain we have the right building and access details before dispatch."],
  ["contact","We couldn't reach you","We tried to reach you to confirm a detail on the order."],
  ["cod","Cash on delivery confirmation","We confirm cash-on-delivery orders by phone before we dispatch them."],
  ["zone","Delivery zone check","Your area needs a delivery permit or scheduled access, which we're arranging."],
  ["qc","Awaiting quality check","The piece is with our quality team for a final look before it leaves the centre."]
];
var R_ATTEMPT = [
  ["unreach","We couldn't reach you","Our driver called on the number on the order and couldn't get through."],
  ["notfound","Address couldn't be located","The driver couldn't locate the address from the details we have."],
  ["nobody","No one at the location","There was no one available to receive the delivery."],
  ["resched","Rescheduled at your request","You asked us to come at a different time."],
  ["access","Building access or lift restriction","The building didn't allow access or the lift wasn't available for a piece this size."],
  ["security","Security clearance pending","The community or tower required clearance we didn't have on the day."],
  ["payment","Payment not ready","The cash-on-delivery amount wasn't ready at handover."]
];
var R_DELAY = [
  ["supplier","Supplier delay","Our supplier needs a little longer to release the piece."],
  ["customs","Customs clearance","The shipment is clearing customs."],
  ["transit","In transit to hub","The piece is moving between our centres."],
  ["demand","High demand","This piece sold faster than we restocked it."],
  ["weather","Weather or road conditions","Conditions on the route made delivery unsafe today."]
];
var R_CANCEL = [
  ["requested","Cancelled at your request","You asked us to cancel this order."],
  ["unpaid","Payment not completed","The payment wasn't completed in time."],
  ["unavail","Item unavailable","The piece became unavailable before we could dispatch it."],
  ["dupe","Duplicate order","This order was placed twice."],
  ["zone","Address not serviceable","We're not able to deliver to this address yet."]
];
var R_MODIFY = [
  ["swap","Item changed","We swapped a piece on your order."],
  ["qty","Quantity changed","We updated the quantity on your order."],
  ["addr","Address updated","We updated the delivery address."],
  ["contact","Contact updated","We updated the contact number on the order."],
  ["date","Delivery date moved","We moved your delivery to a new date."]
];
var R_DECLINE = [
  ["window","Outside the return window","The request came in after the return period for this piece."],
  ["flagged","Piece not eligible for return","This piece is marked non-returnable, which is shown on the product page and your confirmation."],
  ["used","Piece has been used or installed","The piece shows signs of use or installation."],
  ["packaging","Original packaging missing","We need the original packaging to accept the piece back."],
  ["nodamage","No damage found on inspection","Our quality team inspected the piece and found it in sound condition."]
];
var R_PICKUP = [
  ["unreach","We couldn't reach you","Our driver called and couldn't get through."],
  ["notready","Piece wasn't ready","The piece wasn't packed and ready at collection time."],
  ["nobody","No one at the location","There was no one available to hand the piece over."],
  ["resched","Rescheduled at your request","You asked us to collect at a different time."]
];

/* ============ field sources ============ */
var FS = {
  "customer.first_name":"shopify","customer.full_name":"shopify","customer.phone":"shopify","customer.email":"shopify",
  "order.number":"shopify","order.created_at":"shopify","order.status_url":"shopify","order.line_items":"shopify",
  "order.subtotal":"shopify","order.shipping":"shopify","order.total_ex_vat":"shopify","order.vat":"shopify",
  "order.total_inc_vat":"shopify","order.discount_saved":"shopify","order.payment_method":"shopify",
  "shipping_address":"shopify","billing_address":"shopify","shipping_method":"shopify","refund.amount":"shopify",
  "refund.method":"shopify","order.cancel_reason":"shopify","product.image":"shopify","product.return_eligible":"shopify",
  "logistics.awb":"dobesell","logistics.courier":"dobesell","logistics.eta":"dobesell","logistics.slot":"dobesell",
  "logistics.attempt_no":"dobesell","logistics.attempt_reason":"dobesell","logistics.fulfilment_centre":"dobesell",
  "logistics.timestamp":"dobesell","logistics.fulfilment_model":"dobesell","logistics.pickup_slot":"dobesell",
  "logistics.inspection_status":"dobesell","invoice.tax_invoice_url":"dobesell","logistics.hold_flag":"dobesell",
  "ticket.id":"freshdesk","ticket.reason_code":"freshdesk","ticket.agent_note":"freshdesk","ticket.status":"freshdesk"
};
var SRC_LABEL = {shopify:"🛍️ Shopify",dobesell:"🚚 Dobesell",freshdesk:"🎧 Freshdesk"};

var CORE = ["customer.first_name","order.number","order.status_url"];

/* ============ templates ============ */
function t(id,fam,emoji,pill,h1,msg,reasons,extra,wa,fields,full){
  return {id:id,fam:fam,emoji:emoji,pill:pill,h1:h1,msg:msg,reasons:reasons,extra:extra,wa:wa,
          fields:CORE.concat(fields||[]),full:!!full};
}

var ORDER = [
 t("order_confirmed","order","🧾","ORDER CONFIRMED","Thank you, {name}.",
   "We've received your order and are preparing every piece with care. A quick confirmation that your space is about to feel a little more like home.",
   null,null,
   "Hello {name} 👋\n\nThank you for your order with *HomeKode*.\n\n*Order:* {order}\n*Placed:* {date}\n*Item:* {item}\n*Total (incl. VAT):* {total}\n\nWe're preparing every piece with care. Estimated delivery is {eta}.\n\nYou can follow your order here: {link}\n\nWe're here seven days a week, 9am–9pm 🤍",
   ["customer.full_name","order.created_at","order.line_items","order.subtotal","order.shipping","order.total_ex_vat","order.vat","order.total_inc_vat","order.discount_saved","order.payment_method","shipping_address","billing_address","shipping_method","product.image","product.return_eligible","logistics.eta"],true),

 t("payment_confirmed","order","💳","PAYMENT CONFIRMED","Payment received, {name}.",
   "Your payment has cleared and order {order} is moving into preparation. Nothing further is needed from you.",
   null,[["Amount","{total}"],["Method","{pay}"],["Order","{order}"]],
   "Hello {name} 👋\n\nGood news — your payment for order {order} has been confirmed.\n\n*Amount:* {total}\n*Method:* {pay}\n\nYour order is now being prepared. We'll message you the moment it ships 📦",
   ["order.payment_method","order.total_inc_vat","invoice.tax_invoice_url"]),

 t("order_on_hold","order","⏸️","ORDER ON HOLD","A short pause on your order, {name}.",
   "We've placed order {order} on hold for a moment. We'd rather tell you exactly why than leave you wondering.",
   R_HOLD,[["Order","{order}"],["Item","{item}"]],
   "Hello {name} 👋\n\nWe've put order {order} on a short hold.\n\n*Reason:* {reasonLabel}\n{reasonLine}\n\nNothing is lost — your order is safe with us. Our team is on it and we'll update you as soon as it moves.\n\nNeed us? We're here 9am–9pm, every day 🤍",
   ["logistics.hold_flag","ticket.reason_code","ticket.agent_note"]),

 t("in_preparation","order","🛠️","IN PREPARATION","Your order is being prepared, {name}.",
   "Order {order} is with our team now. Each piece is checked and wrapped before it leaves us.",
   null,[["Item","{item}"],["Estimated delivery","{eta}"]],
   "Hello {name} 👋\n\nYour order {order} is being prepared right now.\n\n*Item:* {item}\n*Estimated delivery:* {eta}\n\nWe'll let you know the moment it's on the move 🛠️",
   ["logistics.eta","logistics.fulfilment_model"]),

 t("fulfilled","order","📦","FULFILLED","Your order is packed, {name}.",
   "Order {order} has been fulfilled and is ready to leave our fulfilment centre.",
   null,[["Fulfilment centre","{fc}"],["Item","{item}"]],
   "Hello {name} 👋\n\nYour order {order} is packed and ready to leave our fulfilment centre 📦\n\n*Item:* {item}\n\nYour tracking details are on the way.",
   ["logistics.fulfilment_centre","logistics.timestamp","order.line_items"]),

 t("shipped","order","🚚","SHIPPED","On its way, {name}.",
   "Order {order} has left our centre and is with the courier. You can follow it from here.",
   null,[["Tracking","{awb}"],["Courier","{courier}"],["Estimated delivery","{eta}"]],
   "Hello {name} 👋\n\nYour order {order} is on its way 🚚\n\n*Tracking:* {awb}\n*Courier:* {courier}\n*Estimated delivery:* {eta}\n\nFollow it here: {link}",
   ["logistics.awb","logistics.courier","logistics.eta"]),

 t("delivery_scheduled","order","📅","DELIVERY SCHEDULED","Your delivery is booked, {name}.",
   "We've scheduled delivery for order {order}. If the slot doesn't suit you, one message and we'll move it.",
   null,[["Slot","{slot}"],["Item","{item}"]],
   "Hello {name} 👋\n\nYour delivery is booked 📅\n\n*Slot:* {slot}\n*Item:* {item}\n\nIf this time doesn't suit you, just reply here and we'll move it — no trouble at all.",
   ["logistics.slot","logistics.courier"]),

 t("out_for_delivery","order","🛵","OUT FOR DELIVERY","Arriving today, {name}.",
   "Order {order} is out for delivery. Our driver will call you before arriving.",
   null,[["Slot","{slot}"],["Tracking","{awb}"]],
   "Hello {name} 👋\n\nYour order {order} is out for delivery today 🛵\n\n*Expected:* {slot}\n\nOur driver will call before arriving. Please keep the entrance and lift access clear if you can 🤍",
   ["logistics.slot","logistics.awb","customer.phone"]),

 t("attempt_1","order","⚠️","FIRST ATTEMPT — NOT DELIVERED","We tried to reach you, {name}.",
   "We attempted to deliver order {order} today and weren't able to complete it. Here's what happened and what we'll do next.",
   R_ATTEMPT,[["Attempt","1 of 3"],["Item","{item}"]],
   "Hello {name} 👋\n\nWe tried to deliver your order {order} today but couldn't complete it.\n\n*Reason:* {reasonLabel}\n{reasonLine}\n\nWe'll try again on the next working day. To pick a time that suits you better, just reply here 📅",
   ["logistics.attempt_no","logistics.attempt_reason","logistics.timestamp"]),

 t("attempt_2","order","⚠️","SECOND ATTEMPT — NOT DELIVERED","Second attempt, {name}.",
   "This was our second attempt to deliver order {order}. We'd like to get this right on the next one.",
   R_ATTEMPT,[["Attempt","2 of 3"],["Item","{item}"]],
   "Hello {name} 👋\n\nThis was our second attempt to deliver order {order}.\n\n*Reason:* {reasonLabel}\n{reasonLine}\n\nWe have one attempt left before the piece returns to our centre. Please reply with a time that works for you and we'll be there ⏰",
   ["logistics.attempt_no","logistics.attempt_reason","logistics.timestamp"]),

 t("rto","order","🔁","RETURNING TO OUR CENTRE","An update on order {order}, {name}.",
   "After three attempts we weren't able to complete delivery, so the piece is returning to our fulfilment centre. It isn't cancelled — we can send it out again whenever you're ready.",
   R_ATTEMPT,[["Attempts","3 of 3"],["Now at","{fc}"]],
   "Hello {name} 👋\n\nAfter three attempts we couldn't complete delivery, so your piece is heading back to our centre.\n\n*Reason:* {reasonLabel}\n\nThis isn't the end — reply here and we'll arrange a new delivery whenever suits you 🤍",
   ["logistics.attempt_no","logistics.fulfilment_centre","ticket.id"]),

 t("delivered","order","✅","DELIVERED","It's home, {name}.",
   "Order {order} has been delivered. We hope it sits beautifully in your space.",
   null,[["Delivered","{date}"],["Item","{item}"]],
   "Hello {name} 👋\n\nYour order {order} has been delivered ✅\n\nWe hope it looks wonderful in your space. If anything isn't quite right, tell us within the return window and we'll take care of it 🤍",
   ["logistics.timestamp","product.return_eligible"]),

 t("partially_fulfilled","order","📦","PARTIALLY FULFILLED","Part of your order is on its way, {name}.",
   "Some pieces from order {order} are ready and shipping now. The rest will follow, and you won't pay anything extra for the split.",
   null,[["Shipping now","{item}"],["To follow","Remaining pieces"]],
   "Hello {name} 👋\n\nPart of your order {order} is on its way now 📦\n\n*Shipping now:* {item}\n\nThe remaining pieces follow shortly, at no extra cost to you. We'll message you again when they move.",
   ["order.line_items","logistics.fulfilment_model"]),

 t("order_modified","order","✏️","ORDER UPDATED","Your order has been updated, {name}.",
   "We've made a change to order {order}. Please have a quick look and tell us if anything doesn't match what you expected.",
   R_MODIFY,[["Order","{order}"],["New total","{total}"]],
   "Hello {name} 👋\n\nWe've updated your order {order}.\n\n*Change:* {reasonLabel}\n{reasonLine}\n\n*New total:* {total}\n\nIf this doesn't look right, reply here and we'll fix it straight away ✏️",
   ["order.line_items","order.total_inc_vat","ticket.agent_note"]),

 t("order_cancelled","order","❌","ORDER CANCELLED","Order {order} has been cancelled, {name}.",
   "This order has been cancelled. If a payment was taken, it's already on its way back to you.",
   R_CANCEL,[["Order","{order}"],["Refund","{total} · {pay}"]],
   "Hello {name} 👋\n\nYour order {order} has been cancelled.\n\n*Reason:* {reasonLabel}\n{reasonLine}\n\nAny amount paid is being returned to your original payment method within 7–14 working days.\n\nIf this wasn't what you wanted, we're right here 🤍",
   ["order.cancel_reason","refund.amount","refund.method"]),

 t("delayed","order","🕰️","DELAYED","A short delay, {name}.",
   "Order {order} is taking a little longer than we promised. We're sorry — here's the honest reason and the new date.",
   R_DELAY,[["New estimate","{eta}"],["Item","{item}"]],
   "Hello {name} 👋\n\nYour order {order} is running a little later than planned, and we're sorry for that.\n\n*Reason:* {reasonLabel}\n{reasonLine}\n\n*New estimate:* {eta}\n\nThank you for your patience — we'll keep you posted 🕰️",
   ["logistics.eta","logistics.hold_flag","ticket.agent_note"]),

 t("ready_collection","order","🏬","READY FOR COLLECTION","Ready when you are, {name}.",
   "Order {order} is packed and waiting for you at our collection point.",
   null,[["Collect from","{fc}"],["Bring","Order number and ID"]],
   "Hello {name} 👋\n\nYour order {order} is ready for collection 🏬\n\n*Collect from:* {fc}\n*Please bring:* your order number and ID\n\nOpen seven days a week, 9am–9pm.",
   ["logistics.fulfilment_centre","logistics.slot"])
];

var RETURNS = [
 t("ret_received","returns","📥","RETURN REQUEST RECEIVED","We've got your request, {name}.",
   "We've received your return request for the {item}, because {reasonPhrase}. Nothing more is needed from you right now — our team is reviewing it.",
   R_RETURN,[["Request","{ticket}"],["Order","{order}"]],
   "Hello {name} 👋\n\nWe've received your return request for the *{item}*, because {reasonPhrase}.\n\n*Request:* {ticket}\n*Order:* {order}\n\nOur team is reviewing it now and you'll hear from us within 24 hours. Thank you for telling us 🤍",
   ["ticket.id","ticket.reason_code","order.line_items","product.image"]),

 t("ret_review","returns","🔍","UNDER REVIEW","We're looking into it, {name}.",
   "Your request for the {item} is with our team. Because {reasonPhrase}, we may ask you for a photo to speed things up.",
   R_RETURN,[["Request","{ticket}"],["Expected reply","Within 24 hours"]],
   "Hello {name} 👋\n\nYour request {ticket} for the *{item}* is under review.\n\nBecause {reasonPhrase}, a quick photo would help us move faster — you can send it right here 📷\n\nWe'll come back to you within 24 hours.",
   ["ticket.id","ticket.status","ticket.agent_note"]),

 t("ret_approved","returns","✅","RETURN APPROVED","Approved, {name}.",
   "Your return for the {item} has been approved, because {reasonPhrase}. We'll arrange collection at a time that suits you.",
   R_RETURN,[["Request","{ticket}"],["Next step","We call to book collection"]],
   "Hello {name} 👋\n\nYour return for the *{item}* has been approved ✅\n\nWe'll be in touch to book a collection slot that suits you. Please keep the piece and its packaging together if you can.\n\nRequest: {ticket}",
   ["ticket.id","ticket.reason_code","logistics.pickup_slot"]),

 t("ret_declined","returns","🚫","REQUEST NOT APPROVED","About your request, {name}.",
   "We weren't able to approve the return for the {item}, and we want to be straight with you about why.",
   R_DECLINE,[["Request","{ticket}"],["Talk to us","9am–9pm, every day"]],
   "Hello {name} 👋\n\nWe weren't able to approve the return for the *{item}*.\n\n*Reason:* {reasonLabel}\n{reasonLine}\n\nIf you feel something's been missed, reply here — a senior member of our team will take another look 🤍",
   ["ticket.id","ticket.agent_note","product.return_eligible"]),

 t("ret_pickup_scheduled","returns","📅","COLLECTION SCHEDULED","Collection booked, {name}.",
   "We've booked a collection for the {item}. Please have the piece ready in its packaging if you still have it.",
   null,[["Slot","{slot}"],["Request","{ticket}"]],
   "Hello {name} 👋\n\nWe've booked the collection of your *{item}* 📅\n\n*Slot:* {slot}\n\nPlease have the piece ready, with its packaging if you still have it. If the time doesn't suit, reply and we'll move it.",
   ["logistics.pickup_slot","ticket.id","logistics.courier"]),

 t("ret_pickup_attempted","returns","⚠️","COLLECTION ATTEMPTED","We tried to collect, {name}.",
   "We came for the {item} but weren't able to collect it. Here's why, and we'll happily try again.",
   R_PICKUP,[["Attempt","1"],["Request","{ticket}"]],
   "Hello {name} 👋\n\nWe came to collect your *{item}* but couldn't complete it.\n\n*Reason:* {reasonLabel}\n{reasonLine}\n\nReply with a time that suits you and we'll come back 📅",
   ["logistics.attempt_no","logistics.attempt_reason","ticket.id"]),

 t("ret_collected","returns","📦","ITEM COLLECTED","Collected, {name}.",
   "We've collected the {item}. It's now travelling to our fulfilment centre, and we'll write again when it arrives.",
   null,[["Collected","{date}"],["Tracking","{awb}"]],
   "Hello {name} 👋\n\nWe've collected your *{item}* 📦\n\n*Tracking:* {awb}\n\nIt's on its way to our fulfilment centre. We'll message you the moment it arrives.",
   ["logistics.awb","logistics.timestamp","ticket.id"]),

 t("ret_received_fc","returns","🏭","RECEIVED AT FULFILMENT CENTRE","It's arrived with us, {name}.",
   "The {item} has reached our fulfilment centre. Our quality team will inspect it within 48 hours.",
   null,[["Received at","{fc}"],["Inspection","Within 48 hours"]],
   "Hello {name} 👋\n\nYour *{item}* has arrived at our fulfilment centre 🏭\n\nOur quality team will inspect it within 48 hours, then we'll move straight to your refund or replacement.",
   ["logistics.fulfilment_centre","logistics.timestamp"]),

 t("ret_inspection","returns","🔬","QUALITY INSPECTION","Inspection under way, {name}.",
   "Our quality team is inspecting the {item} now. This is the last step before your refund or replacement is released.",
   R_RETURN,[["Request","{ticket}"],["Typical time","24–48 hours"]],
   "Hello {name} 👋\n\nOur quality team is inspecting your *{item}* now 🔬\n\nThis usually takes 24–48 hours and it's the last step before we release your refund or replacement.",
   ["logistics.inspection_status","ticket.id"]),

 t("ret_replacement","returns","🔄","REPLACEMENT DISPATCHED","Your replacement is on its way, {name}.",
   "A replacement for the {item} has been dispatched, because {reasonPhrase}. There's nothing further to pay.",
   R_RETURN,[["Tracking","{awb}"],["Estimated delivery","{eta}"]],
   "Hello {name} 👋\n\nYour replacement *{item}* is on its way 🔄\n\n*Tracking:* {awb}\n*Estimated delivery:* {eta}\n\nNothing further to pay. Thank you for your patience with us 🤍",
   ["logistics.awb","logistics.eta","ticket.reason_code"]),

 t("ret_refund_initiated","returns","💸","REFUND INITIATED","Your refund is on its way, {name}.",
   "We've released the refund for the {item}. Your bank decides the final timing, and it usually lands within 7–14 working days.",
   null,[["Amount","{total}"],["Back to","{pay}"]],
   "Hello {name} 👋\n\nYour refund has been released 💸\n\n*Amount:* {total}\n*Back to:* {pay}\n\nBanks usually take 7–14 working days to show it. We'll confirm here once it completes.",
   ["refund.amount","refund.method","order.payment_method"]),

 t("ret_refund_completed","returns","🏦","REFUND COMPLETED","All settled, {name}.",
   "Your refund for the {item} has completed. Thank you for giving us the chance to put it right.",
   null,[["Amount","{total}"],["Method","{pay}"]],
   "Hello {name} 👋\n\nYour refund of *{total}* has completed 🏦\n\nThank you for giving us the chance to put this right. We'd love to welcome you back whenever you're ready 🤍",
   ["refund.amount","refund.method"]),

 t("ret_credit","returns","🎁","STORE CREDIT ISSUED","Store credit added, {name}.",
   "We've added store credit for the {item} to your account. It never expires and works on anything in the store.",
   null,[["Credit","{total}"],["Expires","Never"]],
   "Hello {name} 👋\n\nWe've added *{total}* in store credit to your account 🎁\n\nIt doesn't expire and works on anything at HomeKode. Browse whenever you're ready: {link}",
   ["refund.amount","customer.email"])
];

var ALL = ORDER.concat(RETURNS);

/* ============ helpers ============ */
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function fill(str,tpl,reason){
  var rl = reason?reason[1]:"", rn = reason?reason[2]:"", rp = reason?(reason[2]||"").replace(/^We\s/,"we "):"";
  return String(str)
    .replace(/\{name\}/g,D.name).replace(/\{order\}/g,D.order).replace(/\{item\}/g,D.item)
    .replace(/\{date\}/g,D.date).replace(/\{total\}/g,D.total).replace(/\{eta\}/g,D.eta)
    .replace(/\{awb\}/g,D.awb).replace(/\{courier\}/g,D.courier).replace(/\{slot\}/g,D.slot)
    .replace(/\{fc\}/g,D.fc).replace(/\{ticket\}/g,D.ticket).replace(/\{pay\}/g,D.payMethod)
    .replace(/\{reasonLabel\}/g,rl).replace(/\{reasonLine\}/g,rn).replace(/\{reasonPhrase\}/g,rp)
    .replace(/\{link\}/g,"homekode.com/account");
}

var LOGO = '<div class="hk-mark">'+
 '<svg width="40" height="16" viewBox="0 0 40 16" fill="none" aria-hidden="true"><path d="M2 15 L20 2 L38 15" stroke="#22201C" stroke-width="1.1" fill="none"/></svg>'+
 '<div class="hk-word">HOME<br>KODE</div></div>';

var FOOT = '<div class="m-help"><h3>We’re here to <i>help</i></h3>'+
 '<p>Customer care, seven days a week &middot; 9am–9pm</p>'+
 '<div class="m-icons"><a href="https://homekode.com/" title="Email">✉️</a>'+
 '<a href="https://wa.me/97144397621" title="WhatsApp">💬</a>'+
 '<a href="tel:+97144397621" title="Call">📞</a></div></div>'+
 '<div class="m-band"><span>Lifestyle image · served from the Shopify CDN</span></div>'+
 '<div class="m-foot"><a class="l" href="https://homekode.com/">Upgrade Your Home | HomeKode | Dubai, UAE</a>'+
 '<div class="socs"><span>📷</span><span>🎵</span><span>📌</span><span>💼</span></div>'+
 '<div class="legal">You’re receiving this email because you placed an order with HomeKode.<br>&copy; 2026 HomeKode. All rights reserved.</div></div>';

function orderBlock(){
  return '<hr><div class="m-meta">'+
   '<div><div class="lbl2">Order</div><b>'+esc(D.order)+'</b></div>'+
   '<div style="text-align:right"><div class="lbl2">Placed</div><b>'+esc(D.date)+'</b></div></div><hr>'+
   '<div class="m-h2">Your pieces</div>'+
   '<div class="m-item"><div class="m-thumb">BENCH</div>'+
     '<div class="body"><div class="nm">'+esc(D.item)+' &times; '+D.qty+'</div>'+
     '<div class="m-note">Estimated delivery: '+esc(D.eta)+'</div>'+
     '<div class="m-flag">Not Eligible for Return</div>'+
     '<div class="m-badge">EID ( 72.50 AED )</div></div>'+
     '<div class="m-price"><div class="m-was">'+esc(D.was)+'</div><div class="m-now">'+esc(D.now)+'</div></div></div>'+
   '<div class="m-tot">'+
     '<div class="m-row"><span>Subtotal</span><span>'+esc(D.sub)+'</span></div>'+
     '<div class="m-row"><span>Shipping &amp; Handling</span><span>'+esc(D.ship)+'</span></div>'+
     '<div class="m-row"><span>Grand Total (Excl. VAT)</span><span>'+esc(D.exvat)+'</span></div>'+
     '<div class="m-row"><span>Total VAT</span><span>'+esc(D.vat)+'</span></div>'+
     '<div class="m-grand"><div class="g-l">Grand Total (Incl. VAT)</div>'+
       '<div class="g-r"><div class="g-v">'+esc(D.total)+'</div><div class="g-s">You saved '+esc(D.saved)+'</div></div></div>'+
   '</div>'+
   '<div class="m-cta"><a class="btn-a" href="https://homekode.com/account">VIEW ORDER</a>'+
   '<a class="btn-b" href="https://homekode.com/">VISIT STORE</a></div><hr>'+
   '<div class="m-addr">'+
     '<div><span class="lbl2">Shipping address</span><div class="v">'+D.full+'<br>'+D.addr+'</div></div>'+
     '<div><span class="lbl2">Billing address</span><div class="v">'+D.full+'<br>'+D.addr+'</div></div>'+
     '<div><span class="lbl2">Shipping method</span><div class="v">'+esc(D.shipMethod)+'</div></div>'+
     '<div><span class="lbl2">Payment method</span><div class="v">'+esc(D.payMethod)+'</div></div>'+
   '</div>';
}

function statusBlock(tpl,reason){
  var h='';
  if(tpl.extra){
    h+='<hr><div class="m-addr" style="grid-template-columns:1fr 1fr">';
    for(var i=0;i<tpl.extra.length;i++){
      h+='<div><span class="lbl2">'+esc(tpl.extra[i][0])+'</span><div class="v">'+esc(fill(tpl.extra[i][1],tpl,reason))+'</div></div>';
    }
    h+='</div>';
  }
  if(reason){
    h+='<div class="m-reason"><b>Why this happened</b>'+esc(reason[1])+' &mdash; '+esc(reason[2])+'</div>';
  }
  h+='<div class="m-cta"><a class="btn-a" href="https://homekode.com/account">VIEW ORDER</a>'+
     '<a class="btn-b" href="https://homekode.com/">VISIT STORE</a></div>';
  return h;
}

function renderEmail(tpl,reason){
  var h='<div class="mail">'+LOGO+'<div class="inner"><div class="m-mid">'+
    '<span class="m-pill">'+esc(tpl.pill)+'</span>'+
    '<h1 class="m-h1">'+esc(fill(tpl.h1,tpl,reason))+'</h1>'+
    '<p class="m-sub">'+esc(fill(tpl.msg,tpl,reason))+'</p></div>';
  h += tpl.full ? orderBlock() : statusBlock(tpl,reason);
  h += '</div>'+FOOT+'</div>';
  return h;
}

function renderWA(tpl,reason){
  var txt = esc(fill(tpl.wa,tpl,reason)).replace(/\*([^*\n]+)\*/g,"<b>$1</b>");
  return '<div class="wa"><div class="wa-top"><div class="wa-av">HK</div>'+
    '<div><div class="nm">HomeKode <span style="color:#53BDEB;font-size:11px">✓</span></div>'+
    '<div class="st">Business account · online</div></div></div>'+
    '<div class="wa-body"><div class="wa-bub">'+txt+'<span class="wa-time">14:32 ✓✓</span></div></div></div>'+
    '<div class="wa-note">Template must be pre-approved by Meta before it can send outside a 24-hour window.</div>';
}

/* ============ studio wiring ============ */
var elTpl=document.getElementById("s-tpl"), elChan=document.getElementById("s-chan"),
    elSrc=document.getElementById("s-source"), elRe=document.getElementById("s-reason"),
    elReW=document.getElementById("reason-wrap"), stage=document.getElementById("stage"),
    fmap=document.getElementById("fieldmap");

(function(){
  var srcs=[["all","All three systems (recommended)"],["shopify","🛍️ Shopify only"],["dobesell","🚚 Dobesell only"],["freshdesk","🎧 Freshdesk only"]];
  for(var i=0;i<srcs.length;i++){var o=document.createElement("option");o.value=srcs[i][0];o.textContent=srcs[i][1];elSrc.appendChild(o);}
  var g1=document.createElement("optgroup");g1.label="📦 Order journey";
  var g2=document.createElement("optgroup");g2.label="🔄 Returns, refunds & replacements";
  ALL.forEach(function(x){
    var o=document.createElement("option");o.value=x.id;
    o.textContent=x.emoji+"  "+x.pill.replace(/^(.)(.*)$/,function(m,a,b){return a+b.toLowerCase();});
    (x.fam==="order"?g1:g2).appendChild(o);
  });
  elTpl.appendChild(g1);elTpl.appendChild(g2);
})();

function current(){var id=elTpl.value;for(var i=0;i<ALL.length;i++){if(ALL[i].id===id)return ALL[i];}return ALL[0];}

function syncReasons(){
  var tpl=current();
  if(!tpl.reasons){elReW.style.visibility="hidden";elRe.innerHTML="";return;}
  elReW.style.visibility="visible";
  elRe.innerHTML="";
  tpl.reasons.forEach(function(r){var o=document.createElement("option");o.value=r[0];o.textContent=r[1];elRe.appendChild(o);});
}
function activeReason(){
  var tpl=current(); if(!tpl.reasons) return null;
  for(var i=0;i<tpl.reasons.length;i++){if(tpl.reasons[i][0]===elRe.value)return tpl.reasons[i];}
  return tpl.reasons[0];
}

function renderFieldMap(tpl){
  var filter=elSrc.value, rows="";
  tpl.fields.forEach(function(f){
    var s=FS[f]||"shopify";
    if(filter!=="all"&&s!==filter)return;
    rows+='<div class="fieldrow"><code>{{'+esc(f)+'}}</code><span class="chip c-'+s+'">'+SRC_LABEL[s]+'</span></div>';
  });
  fmap.innerHTML = rows || '<p class="sub" style="font-size:12.5px">This template pulls nothing from that system. Switch the source to <b>All three</b> to see the full map. 🔍</p>';
}

function render(){
  var tpl=current(), r=activeReason();
  stage.innerHTML = elChan.value==="email" ? renderEmail(tpl,r) : renderWA(tpl,r);
  renderFieldMap(tpl);
}
elTpl.addEventListener("change",function(){syncReasons();render();});
elChan.addEventListener("change",render);
elSrc.addEventListener("change",render);
elRe.addEventListener("change",render);
syncReasons();render();

/* ============ catalogue tables ============ */
function tableFor(list,el){
  var h='<table><thead><tr><th style="width:34%">Template</th><th style="width:12%">Channels</th><th>Root cause shown to the customer</th></tr></thead><tbody>';
  list.forEach(function(x){
    var reasons = x.reasons ? x.reasons.map(function(r){return esc(r[1]);}).join(" · ") : '<span style="color:var(--muted)">No reason needed — this is good news 🤍</span>';
    h+='<tr><td><b>'+x.emoji+' '+esc(x.pill.charAt(0)+x.pill.slice(1).toLowerCase())+'</b><div style="color:var(--muted);font-size:12px;margin-top:3px">'+esc(fill(x.h1,x,null))+'</div></td>'+
       '<td><span class="chip c-mail">✉️</span> <span class="chip c-wa">💬</span></td>'+
       '<td style="font-size:12.5px;line-height:1.7">'+reasons+'</td></tr>';
  });
  return el.innerHTML=h+'</tbody></table>';
}
tableFor(ORDER,document.getElementById("order-table"));
tableFor(RETURNS,document.getElementById("ret-table"));
document.getElementById("reasoncodes").innerHTML = R_RETURN.map(function(r){return '<span>'+esc(r[1])+'</span>';}).join("");

/* ============ source map ============ */
(function(){
  var by={shopify:[],dobesell:[],freshdesk:[]};
  Object.keys(FS).forEach(function(k){by[FS[k]].push(k);});
  var h='<table><thead><tr><th style="width:16%">System</th><th>Properties it owns</th></tr></thead><tbody>';
  ["shopify","dobesell","freshdesk"].forEach(function(s){
    h+='<tr><td><span class="chip c-'+s+'">'+SRC_LABEL[s]+'</span></td><td><div style="display:flex;flex-wrap:wrap;gap:6px">'+
       by[s].map(function(f){return '<code class="mono" style="font-size:11.5px;background:var(--panel-2);border:1px solid var(--line-soft);border-radius:5px;padding:2px 6px">{{'+esc(f)+'}}</code>';}).join("")+
       '</div></td></tr>';
  });
  document.getElementById("sourcemap").innerHTML=h+'</tbody></table>';
})();

/* ============ live feed (sample until Module 5) ============ */
var EV=[
 ["🆕","New arrival","Varenzo Walnut Center Shelf TV Unit added to Living Room","2m"],
 ["🔻","Price drop","Varenzo Walnut Closed TV Unit · 9,900 → 8,900 AED","14m"],
 ["✅","Back in stock","Graciell Warm Terracotta Bench · 200CM","38m"],
 ["📦","Collection updated","Shop by Material › Marble &amp; Stone · 6 pieces added","1h"],
 ["⛔","Sold out","Evalina Mulberry Sofa Chair","2h"],
 ["🔺","Price increase","Varenzo Walnut Side Shelf TV Unit · 6,900 → 7,400 AED","3h"],
 ["🆕","New arrival","Outdoor › Rattan Lounge Set","4h"]
];
var EXTRA=[
 ["🆕","New arrival","Kids Furniture &amp; Decor · Cloud Bed Frame","just now"],
 ["🔻","Price drop","Mirrors &amp; Wall Decor · Arched Brass Mirror · 1,290 → 1,090 AED","just now"],
 ["✅","Back in stock","Curtains › Linen Blackout · Sand","just now"]
];
var feed=document.getElementById("feed"), cd=document.getElementById("countdown"), n=20, k=0;
function paintFeed(){
  feed.innerHTML=EV.slice(0,7).map(function(e){
    return '<div class="ev"><div class="ic">'+e[0]+'</div><div><div class="t">'+e[1]+'</div><div class="d">'+e[2]+'</div></div><div class="w">'+e[3]+'</div></div>';
  }).join("");
}
paintFeed();
setInterval(function(){
  n--; if(n<=0){ n=20; EV.unshift(EXTRA[k%EXTRA.length]); k++; paintFeed(); }
  cd.textContent="refresh in "+n+"s";
},1000);

/* ============ API connections ============ */
var CONN=[
 {sys:"shopify",name:"Shopify",emoji:"🛍️",mod:3,why:"Order, customer, payment and fulfilment data — and the only trigger that sends a message.",
  keys:[
   ["SHOPIFY_SHOP_DOMAIN","Shop domain",true,"homekode.myshopify.com","Settings → Apps → Develop apps"],
   ["SHOPIFY_ADMIN_TOKEN","Admin API access token",true,"shpat_…","Your custom app → API credentials"],
   ["SHOPIFY_WEBHOOK_SECRET","Webhook signing secret",true,"","Your custom app → Webhooks. This proves a webhook really came from Shopify."],
   ["SHOPIFY_API_VERSION","Admin API version",false,"2026-07","Leave blank for the current stable version."]]},
 {sys:"dobesell",name:"Dobesell",emoji:"🚚",mod:3,why:"AWB and courier telemetry, timestamps, delivery attempts, fulfilment routing, invoices.",
  keys:[
   ["DOBESELL_BASE_URL","API base URL",true,"https://api.dobesell.com/v1","Ask IT for the root URL"],
   ["DOBESELL_API_KEY","API key",true,"","Ask IT for a read-only key scoped to orders, AWB and fulfilment"],
   ["DOBESELL_AUTH_SCHEME","Auth scheme",false,"Bearer","Bearer, ApiKey or Basic — whichever IT specifies"]]},
 {sys:"freshdesk",name:"Freshdesk",emoji:"🎧",mod:3,why:"Ticket ID and status, the reason code your agent captured, and agent notes.",
  keys:[
   ["FRESHDESK_DOMAIN","Freshdesk domain",true,"homekode.freshdesk.com","Your Freshdesk URL"],
   ["FRESHDESK_API_KEY","API key",true,"","Profile settings → Your API key"],
   ["FRESHDESK_REASON_FIELD","Reason-code field ID",false,"","The custom ticket field holding the return reason"]]},
 {sys:"email",name:"Email delivery",emoji:"✉️",mod:4,why:"Sends the branded email. Needs SPF, DKIM and DMARC on homekode.com or mail lands in spam.",
  keys:[
   ["RESEND_API_KEY","Provider API key",true,"re_…","Your email provider dashboard"],
   ["EMAIL_FROM","From address",true,"HomeKode <orders@homekode.com>","Must be on a domain you've verified"],
   ["EMAIL_REPLY_TO","Reply-to address",false,"","Usually your Freshdesk inbox, so replies become tickets"]]},
 {sys:"whatsapp",name:"WhatsApp Business",emoji:"💬",mod:6,why:"Sends the WhatsApp message. Every template must be approved by Meta before it can go out.",
  keys:[
   ["WHATSAPP_TOKEN","Permanent access token",true,"EAA…","Meta Business → WhatsApp → API setup"],
   ["WHATSAPP_PHONE_ID","Phone number ID",true,"","Meta Business → WhatsApp → API setup"],
   ["WHATSAPP_WABA_ID","Business account ID",true,"","Needed to submit templates for approval"]]},
 {sys:"platform",name:"Platform",emoji:"⚙️",mod:5,why:"Internal keys the app generates for itself. No vendor involved.",
  keys:[
   ["POLL_TRIGGER_KEY","Store-poller trigger key",false,"","Any long random string — generate one below"]]}
];

function maskVal(v){
  v=String(v).trim(); if(v.length<=8) return "••••";
  var p = v.indexOf("_")>-1 ? v.slice(0,v.indexOf("_")+1) : "";
  return p+"••••"+v.slice(-4);
}

(function(){
  var wrap=document.getElementById("apiwrap"); if(!wrap) return;
  wrap.innerHTML = CONN.map(function(c){
    var rows = c.keys.map(function(k){
      return '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;padding:12px 0;border-bottom:1px solid var(--line-soft)">'+
        '<div class="sel" style="gap:5px">'+
          '<label class="lbl" for="in-'+k[0]+'">'+esc(k[1])+(k[2]?' <span style="color:var(--crit)">·&nbsp;required</span>':' <span style="color:var(--muted)">·&nbsp;optional</span>')+'</label>'+
          '<input id="in-'+k[0]+'" type="password" autocomplete="off" spellcheck="false" data-key="'+k[0]+'" placeholder="'+esc(k[3]||"Paste here when IT sends it")+'" '+
            'style="font:inherit;font-family:\'JetBrains Mono\',monospace;font-size:12.5px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 10px;width:100%">'+
          '<div style="font-size:11.5px;color:var(--muted)">'+esc(k[4])+'</div>'+
          '<div class="mono" data-slot="'+k[0]+'" style="font-size:11.5px;color:var(--ok);min-height:15px"></div>'+
        '</div>'+
        '<button class="tog" data-save="'+k[0]+'" style="white-space:nowrap">Save</button>'+
      '</div>';
    }).join("");
    return '<div class="card pad">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">'+
        '<div><span class="chip c-'+(c.sys==="email"?"mail":c.sys==="whatsapp"?"wa":c.sys==="platform"?"live":c.sys)+'">'+c.emoji+' '+esc(c.name)+'</span>'+
        '<span class="lbl" style="margin-left:8px">Module '+c.mod+'</span></div>'+
        '<div style="display:flex;gap:8px;align-items:center">'+
          '<span class="chip c-hold" data-status="'+c.sys+'">Not connected</span>'+
          '<button class="tog" data-test="'+c.sys+'">Test connection</button>'+
        '</div>'+
      '</div>'+
      '<p class="sub" style="font-size:12.5px;margin:8px 0 4px">'+esc(c.why)+'</p>'+
      rows+'</div>';
  }).join("");

  wrap.addEventListener("click",function(e){
    var save=e.target.closest("[data-save]"), test=e.target.closest("[data-test]");
    if(save){
      var key=save.getAttribute("data-save");
      var input=document.getElementById("in-"+key);
      var slot=wrap.querySelector('[data-slot="'+key+'"]');
      if(!input.value.trim()){ slot.style.color="var(--crit)"; slot.textContent="Paste a value before saving."; return; }
      slot.style.color="var(--ok)";
      slot.textContent="Saved as "+maskVal(input.value)+" · preview only, nothing stored";
      input.value="";
      var left=wrap.querySelectorAll('[data-slot]').length;
      var done=0; wrap.querySelectorAll('[data-slot]').forEach(function(s){if(s.textContent)done++;});
      document.getElementById("k-missing").textContent=Math.max(0,left-done);
    }
    if(test){
      var sys=test.getAttribute("data-test");
      var badge=wrap.querySelector('[data-status="'+sys+'"]');
      badge.className="chip c-live"; badge.textContent="Testing…";
      setTimeout(function(){
        badge.className="chip c-hold";
        badge.textContent="Needs the live app";
      },700);
    }
  });
})();

/* ============ nav + theme ============ */
var nav=document.getElementById("nav");
nav.addEventListener("click",function(e){
  var b=e.target.closest("button[data-v]"); if(!b)return;
  Array.prototype.forEach.call(nav.querySelectorAll("button"),function(x){x.setAttribute("aria-current",x===b?"true":"false");});
  Array.prototype.forEach.call(document.querySelectorAll(".view"),function(v){v.classList.remove("on");});
  document.getElementById("v-"+b.dataset.v).classList.add("on");
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("tog").addEventListener("click",function(){
  var r=document.documentElement, cur=r.getAttribute("data-theme");
  if(!cur){ cur = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light"; }
  r.setAttribute("data-theme", cur==="dark"?"light":"dark");
});
})();
