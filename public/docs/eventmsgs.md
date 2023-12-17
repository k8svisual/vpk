<topicKey eventmsgs/>
<topicBack id="topicNext" link="containerimages"/>
<topicNext id="topicBack" link="ownerref"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Event Msgs (tab)

A table view of all Event messages that were available in the K8s cluster when the Snapshot was created.  The first 
column is shown with either green, yellow, or red background.  These colors represent Normal, Warning, or Failed messges
respectively.

Use the table __Search__ field to filter the messages that are shown.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_event_msgs.png" width="1024">
</p>

Clicking on a message will either display the resource detail or provide the following message prompt.  This prompt is 
shown when a workload schematic can be shown for the respective message.

If the __'View schematic for involved resource'__ button is pressed view will switch to the Workload Schematic tab and disply the associated schematic.  On the Workload Schematic tab above the schematic will be a 'Return' button.  Press this to return to the 
Events Msgs tab. 

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_event_msgs_action.png" width="800">
</p>

<hr style="border:1px solid #aaaaaa">