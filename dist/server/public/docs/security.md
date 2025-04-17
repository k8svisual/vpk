<topicKey security/>
<topicBack id="topicNext" link="ownerref"/>
<topicNext id="topicBack" link="network"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Security (tab)

Security tab provides a view of the defined role, subject, and bindings for resources in the cluster level or selected namespace.  

From the namespace drop-down select a single namespace.  Once a namespace has been selected press the "__View selected namespace__" button. If there is no selected namespace a warning message is displayed.  

The use of a dashed bounding line is used to group the objects in the selected namespace. Objects outside the dashed bounding line are considered cluster level resources.

Click on any of the displayed objects and the associated resource definition will be displayed.

#### Security view with Namespace items

The following image shows the namespace ‘services’ and the resources defined at the namespace level.  Notice the dashed border around the resources in the namespace.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_security.png" width="1024">
</p>

#### Security view with Cluster level items

The following image shows the cluster level defined resources for the selected namespace.  

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_security2.png" width="1024">
</p>

### Security filter

Once a namespace has been selected filtering provides ability to reduce or modify what is shown.  Select the desired resource type filter.  Once selected press the "__Populate resource names information__ button.  This will populate the selection table.  

From the selection table choose one or more resources to be displayed. Once selected press the button labeled __Apply filter__.  This will also close the filter screen.

The results are a graph of the security bindings.  

Subjects are shown as a rectangle at the top, Bindings are shown as an ellipse in the middle, and Roles shown as a six-sided object at the bottom of the graph.  Below the Role is a list of the defined rules associated with the Role.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_security_filter.png" width="1024">
</p>

### Security legend

The blue circle with the 'i' and can be pressed to view example shapes and colors for the display.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_security_legend.png" width="900">
</p>

<hr style="border:1px solid #aaaaaa">